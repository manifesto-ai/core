<template>
  <div class="hero-background" aria-hidden="true">
    <div class="hero-grid" />
    <div class="hero-glow" />
    <div class="hero-glow hero-glow--secondary" />
  </div>
</template>

<style scoped>
.hero-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

/* Dot grid */
.hero-grid {
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background-image: radial-gradient(
    circle,
    rgba(124, 58, 237, 0.15) 1px,
    transparent 1px
  );
  background-size: 32px 32px;
  animation: grid-drift 25s linear infinite;
  mask-image: radial-gradient(ellipse 60% 60% at 50% 40%, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 60% 60% at 50% 40%, black 20%, transparent 70%);
}

.dark .hero-grid {
  background-image: radial-gradient(
    circle,
    rgba(167, 139, 250, 0.12) 1px,
    transparent 1px
  );
}

@keyframes grid-drift {
  0% { transform: translate(0, 0); }
  100% { transform: translate(32px, 32px); }
}

/* Primary glow */
.hero-glow {
  position: absolute;
  bottom: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(
    ellipse,
    rgba(124, 58, 237, 0.12) 0%,
    rgba(124, 58, 237, 0.04) 40%,
    transparent 70%
  );
  animation: glow-pulse 5s ease-in-out infinite alternate;
}

.dark .hero-glow {
  background: radial-gradient(
    ellipse,
    rgba(167, 139, 250, 0.15) 0%,
    rgba(167, 139, 250, 0.05) 40%,
    transparent 70%
  );
}

/* Secondary glow */
.hero-glow--secondary {
  bottom: auto;
  top: -10%;
  left: 30%;
  width: 400px;
  height: 300px;
  background: radial-gradient(
    ellipse,
    rgba(168, 85, 247, 0.08) 0%,
    transparent 60%
  );
  animation-delay: -2.5s;
  animation-duration: 6s;
}

.dark .hero-glow--secondary {
  background: radial-gradient(
    ellipse,
    rgba(192, 132, 252, 0.08) 0%,
    transparent 60%
  );
}

@keyframes glow-pulse {
  from {
    opacity: 0.6;
    transform: translateX(-50%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-grid,
  .hero-glow {
    animation: none;
  }
}
</style>
