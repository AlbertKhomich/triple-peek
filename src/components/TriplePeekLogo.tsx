import { useId } from "react";

export default function TriplePeekLogo({
  className = "",
}: {
  className?: string;
}) {
  const id = useId();

  return (
    <svg
      viewBox="267 169 1516 326.45"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="TriplePeek"
    >
      <style>{`
        .tp-left-1 {
          animation: tpIn 1s ease both;
        }

        .tp-left-2 {
          animation: tpIn 1s ease 0.2s both;
        }

        .tp-left-3 {
          animation: tpIn 1s ease 0.4s both;
        }

        .tp-peek-dot {
          transform-box: fill-box;
          transform-origin: center;
          animation: tpPeekPulse 2.2s ease-in-out infinite;
        }

        @keyframes tpPeekPulse {
          0%,
          100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.18);
          }
        }

        @keyframes tpIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tp-left-1,
          .tp-left-2,
          .tp-left-3,
          .tp-peek-dot {
            animation: none;
          }
        }
      `}</style>
      <defs>
        <linearGradient id={`${id}-navy`} x1="267" y1="210" x2="359" y2="495" gradientUnits="userSpaceOnUse">
          <stop stopColor="#083b6c"/>
          <stop offset="1" stopColor="#073967"/>
        </linearGradient>
        <linearGradient id={`${id}-blue`} x1="359" y1="170" x2="466" y2="491" gradientUnits="userSpaceOnUse">
          <stop stopColor="#009dff"/>
          <stop offset="1" stopColor="#008ff0"/>
        </linearGradient>
        <linearGradient id={`${id}-teal`} x1="491" y1="205" x2="571" y2="438" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00bca9"/>
          <stop offset="1" stopColor="#00b5a6"/>
        </linearGradient>
        <linearGradient id={`${id}-peek-color`} x1="1230" y1="348" x2="1783" y2="348" gradientUnits="userSpaceOnUse">
          <stop stopColor="#009af7"/>
          <stop offset="0.42" stopColor="#00a9ed"/>
          <stop offset="1" stopColor="#00bda9"/>
        </linearGradient>
      </defs>
      <g className="tp-left-1" fill={`url(#${id}-navy)`}>
        <path d="M267 218 Q267 205 278 211 L354 255 Q359 258 359 265 L359 439 Q359 445 353 449 L279 493 Q267 500 267 487 Z"/>
      </g>
      <g className="tp-left-2" fill={`url(#${id}-blue)`}>
        <path d="M359 177 Q359 165 370 171 L461 225 Q466 228 466 235 L466 440 Q466 446 460 450 L393 489 Q382 496 382 484 L382 253 Q382 247 377 243 L364 235 Q359 232 359 227 Z"/>
      </g>
      <g className="tp-left-3" fill={`url(#${id}-teal)`}>
        <path d="M491 214 Q491 201 502 207 L566 245 Q571 248 571 255 L571 389 Q571 396 565 399 L503 436 Q491 443 491 430 Z"/>
      </g>
      <g className="text-[#0B2348] dark:text-[#F8FBFD]" fill="currentColor">
        <path d="M625 261 H763 V292 H707 V434 H670 V292 H625 Z"/>
        <path d="M752 315 H787 V331 C797 317 813 310 830 314 V347 C807 342 788 351 788 371 V434 H752 Z"/>
        <path d="M842 315 H878 V434 H842 Z"/>
        <circle cx="860.5" cy="278" r="19.5"/>
        <path d="M895 315 H931 V331 C940 317 954 311 971 311 C1007 311 1033 337 1033 375 C1033 412 1007 438 973 438 C955 438 941 431 931 419 V487 H895 Z M931 375 C931 394 945 408 964 408 C983 408 997 394 997 375 C997 356 983 342 964 342 C945 342 931 356 931 375 Z"/>
        <path d="M1044 261 H1079 V434 H1044 Z"/>
        <path d="M1219 384 H1125 C1128 401 1140 411 1157 411 C1169 411 1178 407 1185 396 L1212 409 C1200 429 1182 438 1156 438 C1116 438 1090 412 1090 375 C1090 338 1117 311 1156 311 C1194 311 1219 337 1219 373 Z M1125 362 H1186 C1182 346 1171 338 1156 338 C1140 338 1129 346 1125 362 Z"/>
      </g>
      <g fill={`url(#${id}-peek-color)`}>
        <path d="M1238 314 H1264 Q1275 314 1275 325 V434 H1238 Z"/>
        <path d="M1230 261 H1320 C1355 261 1382 286 1382 320 C1382 355 1357 379 1321 379 H1293 Q1282 379 1282 368 V364 Q1282 353 1293 353 H1309 C1327 353 1339 340 1339 323 C1339 306 1326 292 1309 292 H1241 Q1230 292 1230 281 Z"/>
        <circle
          className="tp-peek-dot"
          cx="1308.5"
          cy="325"
          r="14.5"
        />
        <path d="M1507 384 H1416 C1419 401 1431 411 1448 411 C1460 411 1469 407 1476 396 L1501 409 C1490 429 1472 438 1447 438 C1407 438 1381 412 1381 375 C1381 338 1408 311 1447 311 C1484 311 1507 337 1507 373 Z M1416 362 H1475 C1471 346 1461 338 1446 338 C1431 338 1420 346 1416 362 Z"/>
        <path d="M1642 384 H1551 C1554 401 1566 411 1583 411 C1595 411 1604 407 1611 396 L1636 409 C1625 429 1607 438 1582 438 C1542 438 1516 412 1516 375 C1516 338 1543 311 1582 311 C1619 311 1642 337 1642 373 Z M1551 362 H1610 C1606 346 1596 338 1581 338 C1566 338 1555 346 1551 362 Z"/>
        <path d="M1653 261 H1688 V364 L1737 315 H1782 L1724 373 L1783 434 H1739 L1702 388 L1688 402 V434 H1653 Z"/>
      </g>
    </svg>
  );
}
