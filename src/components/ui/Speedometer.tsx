'use client'

import React from 'react'

interface SpeedometerProps {
    value: number
    max: number
    label?: string
    sublabel?: string
    size?: number
    color?: string
}

export function Speedometer({ value, max, label, sublabel, size = 200, color = "#3b82f6" }: SpeedometerProps) {
    const radius = size * 0.35 // Slightly smaller to fit stroke
    const strokeWidth = size * 0.1
    const center = size / 2

    // Calculate percentage and clap
    const percentage = Math.min(Math.max(value / max, 0), 1)

    // SVG Coordinate System:
    // 0 deg = 3 o'clock (Right)
    // 90 deg = 6 o'clock (Bottom)
    // 180 deg = 9 o'clock (Left)
    // 270 deg = 12 o'clock (Top)

    // We want Start at Bottom Left (135deg) and End at Bottom Right (405deg = 45deg)
    const startAngle = 135
    const endAngle = 405
    const totalAngle = endAngle - startAngle // 270 degrees

    // For the background track (full arc)
    // We draw from Start to End. 
    // BUT SVG Arc command draws from Current Point to Target Point.
    // If we want clockwise arc:
    // M startPoint A radius radius 0 1 1 endPoint

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    const start = polarToCartesian(center, center, radius, startAngle);
    const end = polarToCartesian(center, center, radius, endAngle);

    // Background Path (Full 270)
    // large-arc-flag should be 1 because 270 > 180
    // sweep-flag should be 1 (clockwise)
    const backgroundPath = [
        "M", start.x, start.y,
        "A", radius, radius, 0, 1, 1, end.x, end.y
    ].join(" ");

    // Progress Path
    const currentAngle = startAngle + (percentage * totalAngle)
    const progressEnd = polarToCartesian(center, center, radius, currentAngle);

    // Determine large arc for progress
    // If progress is > 180 degrees (i.e. percentage > 180/270 = ~66%), flag is 1
    const progressLargeArc = (currentAngle - startAngle) <= 180 ? "0" : "1"

    const progressPath = [
        "M", start.x, start.y,
        "A", radius, radius, 0, progressLargeArc, 1, progressEnd.x, progressEnd.y
    ].join(" ");

    // Needle
    // Point to currentAngle
    const needleLength = radius - strokeWidth + 10 // extend a bit inwards? No, outwards usually creates arrow. 
    // Let's make it simple line from center
    const needleEndPos = polarToCartesian(center, center, needleLength, currentAngle)

    return (
        <div className="relative flex flex-col items-center justify-center p-4" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="40%" stopColor="#eab308" />
                        <stop offset="80%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>

                {/* Track */}
                <path
                    d={backgroundPath}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Progress */}
                <path
                    d={progressPath}
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ transition: 'd 1s ease-out' }}
                />

                {/* Needle */}
                <circle cx={center} cy={center} r="6" fill="#fff" />
                <line
                    x1={center}
                    y1={center}
                    x2={needleEndPos.x}
                    y2={needleEndPos.y}
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>

            {/* Labels - Absolute centered but offset down to fit in the opening */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-2 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-bold text-white tabular-nums drop-shadow-lg">
                    {value.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    {sublabel || 'Questões'}
                </span>
                <span className="text-xs text-slate-500 mt-1 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700/50">
                    Meta: {max.toLocaleString()}
                </span>
            </div>
        </div>
    )
}
