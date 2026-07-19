/* Local Arena's decorative configuration field. Forest palette by default. */
(function () {
  const defaults = {
    line: "#3a4028",
    node: "#d6d5ba",
    glow: "#6f9b52",
    accent: "#c1894e",
    warn: "#c06a3a",
    lavender: "#b3a4e6",
  };

  function seededRandom(seed) {
    return function random() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  function withAlpha(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
  }

  class LocalArenaConstellation extends HTMLElement {
    connectedCallback() {
      this.setAttribute("aria-hidden", "true");
      if (!this.canvas) {
        this.style.display = this.style.display || "block";
        this.canvas = document.createElement("canvas");
        this.canvas.style.cssText = "width:100%;height:100%;display:block";
        this.appendChild(this.canvas);
      }
      this.draw();
      if (!this.resizeObserver && window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.draw());
        this.resizeObserver.observe(this);
      }
    }

    disconnectedCallback() {
      this.resizeObserver?.disconnect();
    }

    draw() {
      const rect = this.getBoundingClientRect();
      const width = Math.max(1, rect.width || this.offsetWidth || 640);
      const height = Math.max(1, rect.height || this.offsetHeight || 520);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = this.canvas;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const context = canvas.getContext("2d");
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const palette = {
        line: this.getAttribute("line") || defaults.line,
        node: this.getAttribute("node") || defaults.node,
        glow: this.getAttribute("glow") || defaults.glow,
        accent: this.getAttribute("accent") || defaults.accent,
        warn: this.getAttribute("warn") || defaults.warn,
        lavender: this.getAttribute("lavender") || defaults.lavender,
      };
      const bloom = parseFloat(this.getAttribute("bloom") || "0.5");
      const density = parseInt(this.getAttribute("density") || "130", 10);
      const random = seededRandom(parseInt(this.getAttribute("seed") || "7", 10) * 131 + 9);
      const centerX = width * 0.58;
      const centerY = height * 0.5;
      const radius = Math.min(width, height) * 0.78;
      const nodes = [];

      for (let index = 0; index < density; index += 1) {
        const angle = random() * Math.PI * 2;
        const distance = Math.pow(random(), 0.6) * radius;
        nodes.push({
          x: centerX + Math.cos(angle) * distance * 1.1 + (random() - 0.5) * 70,
          y: centerY + Math.sin(angle) * distance * 0.8 + (random() - 0.5) * 70,
          size: random() < 0.12 ? 2.2 + random() * 2 : 0.6 + random() * 1.3,
          accent: random() < 0.13,
          warning: random() < 0.025,
        });
      }

      for (let first = 0; first < nodes.length; first += 1) {
        for (let second = first + 1; second < nodes.length; second += 1) {
          const a = nodes[first];
          const b = nodes[second];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 104 && random() < 0.55) {
            const green = random() < 0.35;
            context.strokeStyle = green ? palette.glow : palette.line;
            context.lineWidth = green ? 0.8 : 0.7;
            context.globalAlpha = (green ? 0.5 : 0.62) * (1 - distance / 104);
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      context.globalAlpha = 1;
      for (let index = 0; index < 6; index += 1) {
        const x = centerX + (random() - 0.5) * width * 0.7;
        const y = centerY + (random() - 0.5) * height * 0.7;
        const ringWidth = 40 + random() * 160;
        context.strokeStyle = palette.line;
        context.globalAlpha = 0.15;
        context.setLineDash([1, 4]);
        context.beginPath();
        context.ellipse(x, y, ringWidth, ringWidth * (0.5 + random() * 0.4), random() * Math.PI, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }

      for (let index = 0; index < 22; index += 1) {
        const x = centerX - width * 0.3 + random() * width * 0.9;
        const y = centerY - height * 0.35 + random() * height * 0.3;
        context.strokeStyle = palette.line;
        context.globalAlpha = 0.11;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y + 20 + random() * 150);
        context.stroke();
      }

      context.globalAlpha = 1;
      for (const node of nodes) {
        const lavender = random() < 0.045;
        const color = lavender ? palette.lavender : node.warning ? palette.warn : node.accent ? palette.accent : random() < 0.5 ? palette.glow : palette.node;
        if (node.size > 2 || lavender) {
          const gradient = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.size * 6);
          gradient.addColorStop(0, withAlpha(lavender ? palette.lavender : node.warning ? palette.warn : palette.glow, lavender ? 0.6 : bloom));
          gradient.addColorStop(1, withAlpha(palette.glow, 0));
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(node.x, node.y, node.size * 6, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = color;
        context.globalAlpha = node.accent || node.warning || lavender ? 0.95 : 0.72;
        context.beginPath();
        context.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  if (!customElements.get("la-constellation")) {
    customElements.define("la-constellation", LocalArenaConstellation);
  }
})();
