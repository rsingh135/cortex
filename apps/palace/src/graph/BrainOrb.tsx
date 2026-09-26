import styles from "./memory.module.css";

/** Decorative vector brain: the actual memory network opens in the explorer. */
export default function BrainOrb() {
  const dots = Array.from({ length: 38 }, (_, i) => {
    const angle = i * 2.39996323;
    const radius = Math.sqrt((i + 1) / 38);
    return {
      x: 240 + Math.cos(angle) * 120 * radius,
      y: 215 + Math.sin(angle) * 121 * radius,
    };
  });
  return (
    <div className={styles.brainOrb}>
      <svg
        viewBox="0 0 480 430"
        role="img"
        aria-label="Animated Cortex brain illustration"
      >
        <defs>
          <radialGradient id="orb-halo">
            <stop stopColor="#9ecb8d" stopOpacity=".14" />
            <stop offset=".55" stopColor="#668c79" stopOpacity=".05" />
            <stop offset="1" stopColor="#668c79" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="brain-ink" x1=".1" y1="0" x2=".8" y2="1">
            <stop stopColor="#dbebc1" />
            <stop offset=".5" stopColor="#a6c8a9" />
            <stop offset="1" stopColor="#609493" />
          </linearGradient>
          <filter id="brain-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <clipPath id="brain-mask">
            <path d="M238 94C208 68 172 82 159 107C129 107 111 128 111 153C83 173 84 207 100 226C82 258 99 287 121 294C123 325 157 343 183 331C205 354 228 343 239 320L241 105ZM242 94C272 68 308 82 321 107C351 107 369 128 369 153C397 173 396 207 380 226C398 258 381 287 359 294C357 325 323 343 297 331C275 354 252 343 241 320L239 105Z" />
          </clipPath>
        </defs>
        <circle cx="240" cy="215" r="215" fill="url(#orb-halo)" />
        <g
          className={styles.orbOrbit}
          fill="none"
          stroke="#91b99b"
          strokeWidth=".6"
        >
          <ellipse
            cx="240"
            cy="215"
            rx="199"
            ry="112"
            transform="rotate(-28 240 215)"
            opacity=".3"
          />
          <ellipse
            cx="240"
            cy="215"
            rx="187"
            ry="153"
            transform="rotate(36 240 215)"
            opacity=".2"
          />
          <ellipse
            cx="240"
            cy="215"
            rx="179"
            ry="177"
            opacity=".13"
            strokeDasharray="1 10"
          />
          <circle cx="61" cy="184" r="3" fill="#aec99e" stroke="none" />
          <circle cx="406" cy="286" r="2.5" fill="#91b99b" stroke="none" />
        </g>
        <g
          className={styles.orbBrain}
          fill="none"
          stroke="url(#brain-ink)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M238 94C208 68 172 82 159 107C129 107 111 128 111 153C83 173 84 207 100 226C82 258 99 287 121 294C123 325 157 343 183 331C205 354 228 343 239 320L241 105M242 94C272 68 308 82 321 107C351 107 369 128 369 153C397 173 396 207 380 226C398 258 381 287 359 294C357 325 323 343 297 331C275 354 252 343 241 320L239 105"
            strokeWidth="1.4"
            opacity=".9"
          />
          <g strokeWidth="1" opacity=".8">
            <path d="M160 108C185 103 191 126 183 140S150 151 145 173C140 194 160 210 181 203M111 155C142 153 144 134 167 135M101 226C126 214 141 228 141 247S164 271 180 259M121 294C145 301 155 280 174 288S189 317 183 331M238 112C221 107 207 122 214 140S232 166 210 185C187 204 203 226 222 225M232 266C213 245 188 257 191 278S219 300 211 322M161 182C177 170 190 168 194 150M111 261C139 269 153 254 151 235M210 185L172 218 180 259M214 140L194 150 183 140M222 225L210 245 232 266M174 288L191 278" />
            <path d="M320 108C295 103 289 126 297 140S330 151 335 173C340 194 320 210 299 203M369 155C338 153 336 134 313 135M379 226C354 214 339 228 339 247S316 271 300 259M359 294C335 301 325 280 306 288S291 317 297 331M242 112C259 107 273 122 266 140S248 166 270 185C293 204 277 226 258 225M248 266C267 245 292 257 289 278S261 300 269 322M319 182C303 170 290 168 286 150M369 261C341 269 327 254 329 235M270 185L308 218 300 259M266 140L286 150 297 140M258 225L270 245 248 266M306 288L289 278" />
          </g>
          <g clipPath="url(#brain-mask)" strokeWidth=".6" opacity=".2">
            {dots.map((dot, i) => {
              const next = dots[(i + 5) % dots.length];
              return (
                <line key={i} x1={dot.x} y1={dot.y} x2={next.x} y2={next.y} />
              );
            })}
          </g>
          <g stroke="none" fill="#cde0b4" clipPath="url(#brain-mask)">
            {dots.map((dot, i) => (
              <circle
                className={styles.neuron}
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={i % 5 === 0 ? 2.8 : 1.4}
                style={{ animationDelay: `${i * 0.19}s` }}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
