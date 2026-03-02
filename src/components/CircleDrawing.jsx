import React, { useState, useRef, useCallback, useEffect } from 'react';
import '../glow.css';

const WIDTH = 500;
const HEIGHT = 500;
const MIN = -10;
const MAX = 10;
const EXTENDED_MIN = MIN - 1;
const EXTENDED_MAX = MAX + 1;
const PADDING = 40;
const centerX = WIDTH / 2;
const centerY = HEIGHT / 2;
const plotWidth = WIDTH - 2 * PADDING;
const plotHeight = HEIGHT - 2 * PADDING;
const scaleX = plotWidth / (MAX - MIN);
const scaleY = plotHeight / (MAX - MIN);

const valueToX = (x) => centerX + x * scaleX;
const valueToY = (y) => centerY - y * scaleY;
const xToValue = (px) => (px - centerX) / scaleX;
const yToValue = (py) => (centerY - py) / scaleY;

const clamp = (v) => Math.max(MIN, Math.min(MAX, v));
const roundToTick = (v) => Math.round(clamp(v));

const GRID_CELL = scaleX;
const POINT_RADIUS = 6;
const CIRCLE_ANIMATION_DURATION_MS = 1500;
const MAX_CIRCLES = 2;
const MIN_RADIUS = 0.5; // avoid degenerate circle when center and second point coincide

const tickValues = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i);

const CONTAINER_LEFT = 0;
const CONTAINER_TOP = 0;
const CONTAINER_RIGHT = WIDTH;
const CONTAINER_BOTTOM = HEIGHT;

/** Radius in value space → radius in SVG (use scaleX so circle is round on square grid) */
const valueRadiusToSvg = (rValue) => rValue * scaleX;

const CircleDrawing = () => {
	const [hoverPreview, setHoverPreview] = useState(null);
	const [pointsHistory, setPointsHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(0);
	const [circleProgress, setCircleProgress] = useState(0);
	const [animatingCircleIndex, setAnimatingCircleIndex] = useState(null);
	const [showHistoryGlow, setShowHistoryGlow] = useState(true);
	const containerRef = useRef(null);

	const currentPoints = pointsHistory.slice(0, historyIndex);
	const numCircles = Math.floor(historyIndex / 2);

	const allCirclesData = [];
	for (let i = 0; i < numCircles; i++) {
		const center = currentPoints[2 * i];
		const secondPoint = currentPoints[2 * i + 1];
		const cx = center.x;
		const cy = center.y;
		const rValue = Math.hypot(secondPoint.x - cx, secondPoint.y - cy);
		if (rValue >= MIN_RADIUS) {
			allCirclesData.push({ cx, cy, rValue, center, secondPoint, index: i });
		}
	}

	const isAnimating = animatingCircleIndex !== null;
	const visibleCirclesFull = isAnimating
		? allCirclesData.filter((c) => c.index !== animatingCircleIndex).slice(-(MAX_CIRCLES - 1))
		: allCirclesData.slice(-MAX_CIRCLES);
	const animatingCircleData =
		animatingCircleIndex != null && allCirclesData[animatingCircleIndex]
			? allCirclesData[animatingCircleIndex]
			: null;

	const visibleCircleStart = Math.max(0, numCircles - MAX_CIRCLES);
	const visiblePointStartIndex = 2 * visibleCircleStart;

	useEffect(() => {
		if (animatingCircleIndex == null) return;
		setCircleProgress(0);
		const start = performance.now();
		const tick = (now) => {
			const elapsed = now - start;
			const progress = Math.min(1, elapsed / CIRCLE_ANIMATION_DURATION_MS);
			setCircleProgress(progress);
			if (progress < 1) {
				requestAnimationFrame(tick);
			} else {
				setAnimatingCircleIndex(null);
				setCircleProgress(1);
			}
		};
		const id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	}, [animatingCircleIndex]);

	const clientToSvg = useCallback((clientX, clientY) => {
		const el = containerRef.current;
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(WIDTH, clientX - rect.left)),
			y: Math.max(0, Math.min(HEIGHT, clientY - rect.top)),
		};
	}, []);

	const handleClick = useCallback(
		(e) => {
			if (animatingCircleIndex !== null) return;
			const pt = clientToSvg(e.clientX, e.clientY);
			if (!pt) return;
			const valuePoint = { x: roundToTick(xToValue(pt.x)), y: roundToTick(yToValue(pt.y)) };

			const nextIndex = historyIndex + 1;
			setPointsHistory((prev) => [...prev.slice(0, historyIndex), valuePoint]);
			setHistoryIndex(nextIndex);
			if (nextIndex >= 2 && nextIndex % 2 === 0) {
				setAnimatingCircleIndex(nextIndex / 2 - 1);
			}
		},
		[clientToSvg, historyIndex, animatingCircleIndex]
	);

	const handleMouseMove = useCallback(
		(e) => {
			const pt = clientToSvg(e.clientX, e.clientY);
			if (!pt) {
				setHoverPreview(null);
				return;
			}
			setHoverPreview({ x: roundToTick(xToValue(pt.x)), y: roundToTick(yToValue(pt.y)) });
		},
		[clientToSvg]
	);

	const handleMouseLeave = useCallback(() => setHoverPreview(null), []);

	const canUndo = historyIndex > 0;
	const canRedo = historyIndex < pointsHistory.length;
	const canReset = pointsHistory.length > 0;
	const buttonStyle = (enabled) => ({
		padding: '4px 8px',
		fontSize: 12,
		cursor: enabled ? 'pointer' : 'default',
		opacity: enabled ? 1 : 0.5,
	});

	const centerForGhost = historyIndex > 0 && historyIndex % 2 === 1 ? currentPoints[historyIndex - 1] : null;
	let ghostCircleData = null;
	if (centerForGhost && hoverPreview) {
		const rValue = Math.hypot(hoverPreview.x - centerForGhost.x, hoverPreview.y - centerForGhost.y);
		if (rValue >= MIN_RADIUS) {
			ghostCircleData = {
				cx: centerForGhost.x,
				cy: centerForGhost.y,
				rValue,
			};
		}
	}

	const arrowSize = 8;
	const xMin = valueToX(EXTENDED_MIN);
	const xMax = valueToX(EXTENDED_MAX);
	const yMin = valueToY(EXTENDED_MIN);
	const yMax = valueToY(EXTENDED_MAX);
	const xAxisLeft = xMin + arrowSize;
	const xAxisRight = xMax - arrowSize;
	const yAxisTop = yMax + arrowSize;
	const yAxisBottom = yMin - arrowSize;

	return (
		<div
			ref={containerRef}
			className="circle-drawing"
			role="application"
			aria-label="Circle drawing coordinate plane"
			tabIndex={0}
			onClick={handleClick}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			style={{
				position: 'relative',
				width: WIDTH,
				height: HEIGHT,
				border: '1px solid #ccc',
				borderRadius: 4,
				overflow: 'hidden',
				backgroundColor: '#fff',
				cursor: 'crosshair',
				userSelect: 'none',
				WebkitUserSelect: 'none',
				MozUserSelect: 'none',
				msUserSelect: 'none',
			}}
		>
			<div
				className={`segmented-glow-button simple-glow compact${!showHistoryGlow ? ' hide-orbit' : ''}`}
				style={{ position: 'absolute', top: 11, right: 12, zIndex: 1 }}
			>
				<div className="segment-container">
					<button
						type="button"
						className={`segment ${!canUndo ? 'inactive' : ''}`}
						onClick={(e) => {
							e.stopPropagation();
							if (!canUndo) return;
							setShowHistoryGlow(false);
							setHistoryIndex((i) => Math.max(0, i - 1));
							if (animatingCircleIndex !== null && historyIndex === 2 * (animatingCircleIndex + 1)) {
								setAnimatingCircleIndex(null);
								setCircleProgress(0);
							}
						}}
						disabled={!canUndo}
					>
						Undo
					</button>
					<button
						type="button"
						className={`segment ${!canRedo ? 'inactive' : ''}`}
						onClick={(e) => {
							e.stopPropagation();
							if (!canRedo) return;
							setShowHistoryGlow(false);
							setHistoryIndex((i) => Math.min(pointsHistory.length, i + 1));
						}}
						disabled={!canRedo}
					>
						Redo
					</button>
					<button
						type="button"
						className={`segment ${!canReset ? 'inactive' : ''}`}
						onClick={(e) => {
							e.stopPropagation();
							if (!canReset) return;
							setShowHistoryGlow(false);
							setPointsHistory([]);
							setHistoryIndex(0);
							setCircleProgress(0);
							setAnimatingCircleIndex(null);
						}}
						disabled={!canReset}
					>
						Reset
					</button>
				</div>
			</div>
			<svg width={WIDTH} height={HEIGHT} style={{ display: 'block', pointerEvents: 'none' }}>
				<defs>
					<pattern
						id="grid-circle"
						x={PADDING}
						y={PADDING}
						width={GRID_CELL}
						height={GRID_CELL}
						patternUnits="userSpaceOnUse"
					>
						<path
							d={`M 0 0 L 0 ${GRID_CELL} M 0 0 L ${GRID_CELL} 0 M ${GRID_CELL} 0 L ${GRID_CELL} ${GRID_CELL} M 0 ${GRID_CELL} L ${GRID_CELL} ${GRID_CELL}`}
							stroke="#e6e6e6"
							strokeWidth="1"
							fill="none"
						/>
					</pattern>
					<clipPath id="plot-clip-circle">
						<rect x={CONTAINER_LEFT} y={CONTAINER_TOP} width={CONTAINER_RIGHT} height={CONTAINER_BOTTOM} />
					</clipPath>
				</defs>
				<rect width={WIDTH} height={HEIGHT} fill="url(#grid-circle)" />
				<line x1={xAxisLeft} y1={centerY} x2={xAxisRight} y2={centerY} stroke="#999999" strokeWidth={2} />
				<line x1={centerX} y1={yAxisTop} x2={centerX} y2={yAxisBottom} stroke="#999999" strokeWidth={2} />
				{/* Axis labels */}
				<text
					x={valueToX(10)}
					y={centerY - 12}
					textAnchor="middle"
					fontSize="14px"
					fontWeight="bold"
					fontStyle="italic"
					fill="#999999"
					fontFamily="'Latin Modern Roman CK12', 'Latin Modern Roman', serif"
				>
					x-axis
				</text>
				<text
					x={centerX + 14}
					y={yMax + 5}
					textAnchor="start"
					dominantBaseline="middle"
					fontSize="14px"
					fontWeight="bold"
					fontStyle="italic"
					fill="#999999"
					fontFamily="'Latin Modern Roman CK12', 'Latin Modern Roman', serif"
				>
					y-axis
				</text>
				{tickValues.map((value) => {
					const x = valueToX(value);
					return (
						<g key={`x-${value}`}>
							<line x1={x} y1={centerY} x2={x} y2={centerY + 10} stroke="#999999" strokeWidth={1.5} />
							{value !== 0 && (
								<text
									x={x}
									y={centerY + 26}
									textAnchor="middle"
									fontSize="14px"
									fontWeight="bold"
									fill="#999999"
									fontFamily="'Latin Modern Roman CK12', 'Latin Modern Roman', serif"
								>
									{value}
								</text>
							)}
						</g>
					);
				})}
				{tickValues.map((value) => {
					const y = valueToY(value);
					return (
						<g key={`y-${value}`}>
							<line x1={centerX} y1={y} x2={centerX - 10} y2={y} stroke="#999999" strokeWidth={1.5} />
							{value !== 0 && (
								<text
									x={centerX - 14}
									y={y + 5}
									textAnchor="end"
									fontSize="14px"
									fontWeight="bold"
									fill="#999999"
									fontFamily="'Latin Modern Roman CK12', 'Latin Modern Roman', serif"
								>
									{value}
								</text>
							)}
						</g>
					);
				})}
				<polygon
					points={`${xMax - arrowSize},${centerY - arrowSize} ${xMax},${centerY} ${xMax - arrowSize},${centerY + arrowSize}`}
					fill="#999999"
				/>
				<polygon
					points={`${xMin + arrowSize},${centerY - arrowSize} ${xMin},${centerY} ${xMin + arrowSize},${centerY + arrowSize}`}
					fill="#999999"
				/>
				<polygon
					points={`${centerX - arrowSize},${yMax + arrowSize} ${centerX},${yMax} ${centerX + arrowSize},${yMax + arrowSize}`}
					fill="#999999"
				/>
				<polygon
					points={`${centerX - arrowSize},${yMin - arrowSize} ${centerX},${yMin} ${centerX + arrowSize},${yMin - arrowSize}`}
					fill="#999999"
				/>

				{/* Visible circles (full), no arrows; points drawn below */}
				{visibleCirclesFull.map(({ cx, cy, rValue }, idx) => (
					<g key={idx} clipPath="url(#plot-clip-circle)">
						<circle
							cx={valueToX(cx)}
							cy={valueToY(cy)}
							r={valueRadiusToSvg(rValue)}
							fill="none"
							stroke="#1967d2"
							strokeWidth={3}
						/>
					</g>
				))}

				{/* Ghost circle */}
				{ghostCircleData && (
					<g clipPath="url(#plot-clip-circle)">
						<circle
							cx={valueToX(ghostCircleData.cx)}
							cy={valueToY(ghostCircleData.cy)}
							r={valueRadiusToSvg(ghostCircleData.rValue)}
							fill="none"
							stroke="#1967d2"
							strokeWidth={2.5}
							strokeOpacity={0.5}
							strokeDasharray="8 6"
						/>
					</g>
				)}

				{/* Animating circle (grows from center) */}
				{animatingCircleData && (
					<g clipPath="url(#plot-clip-circle)">
						<circle
							cx={valueToX(animatingCircleData.cx)}
							cy={valueToY(animatingCircleData.cy)}
							r={valueRadiusToSvg(animatingCircleData.rValue) * circleProgress}
							fill="none"
							stroke="#1967d2"
							strokeWidth={3}
						/>
					</g>
				)}

				{/* Points for visible circles only */}
				{currentPoints.slice(visiblePointStartIndex).map((p, i) => {
					const pointIndex = visiblePointStartIndex + i;
					return (
						<circle
							key={pointIndex}
							cx={valueToX(p.x)}
							cy={valueToY(p.y)}
							r={POINT_RADIUS}
							fill={pointIndex % 2 === 0 ? '#1967d2' : '#1967d2'}
							stroke="#fff"
							strokeWidth={2}
						/>
					);
				})}

				{hoverPreview && (
					<circle
						cx={valueToX(hoverPreview.x)}
						cy={valueToY(hoverPreview.y)}
						r={POINT_RADIUS}
						fill="#1967d2"
						fillOpacity={0.4}
						stroke="#1967d2"
						strokeOpacity={0.5}
						strokeWidth={2}
					/>
				)}
			</svg>
		</div>
	);
};

export default CircleDrawing;
