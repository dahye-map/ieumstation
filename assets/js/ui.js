function loading() {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  const config = {
    particleCount: 5000,
    textArray: ["IEUM", "DESIGN", "CODING"],
    mouseRadius: 0.1,
    particleSize: 2,
    forceMultiplier: 0.001,
    returnSpeed: 0.005,
    velocityDamping: 0.95,
    colorMultiplier: 40000,
    saturationMultiplier: 1000,
    textChangeInterval: 4000,
    rotationForceMultiplier: 0.5
  };

  let currentTextIndex = 0;
  let nextTextTimeout;
  let textCoordinates = [];

  const mouse = {
    x: -500,
    y: -500,
    radius: config.mouseRadius
  };

  const particles = [];
  for (let i = 0; i < config.particleCount; i++) {
    particles.push({ x: 0, y: 0, baseX: 0, baseY: 0, vx: 0, vy: 0 });
  }

  const vertexShaderSource = `
        attribute vec2 a_position;
        attribute float a_hue;
        attribute float a_saturation;
        varying float v_hue;
        varying float v_saturation;
        void main() {
            gl_PointSize = ${config.particleSize.toFixed(1)};
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_hue = a_hue;
            v_saturation = a_saturation;
        }
    `;

  const fragmentShaderSource = `
        precision mediump float;
        varying float v_hue;
        varying float v_saturation;
        void main() {
            float c = v_hue * 6.0;
            float x = 1.0 - abs(mod(c, 2.0) - 1.0);
            vec3 color;
            if (c < 1.0) color = vec3(1.0, x, 0.0);
            else if (c < 2.0) color = vec3(x, 1.0, 0.0);
            else if (c < 3.0) color = vec3(0.0, 1.0, x);
            else if (c < 4.0) color = vec3(0.0, x, 1.0);
            else if (c < 5.0) color = vec3(x, 0.0, 1.0);
            else color = vec3(1.0, 0.0, x);
            vec3 finalColor = mix(vec3(1.0), color, v_saturation);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  const program = createProgram(gl, vertexShader, fragmentShader);

  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const hueAttributeLocation = gl.getAttribLocation(program, "a_hue");
  const saturationAttributeLocation = gl.getAttribLocation(
    program,
    "a_saturation"
  );

  const positionBuffer = gl.createBuffer();
  const hueBuffer = gl.createBuffer();
  const saturationBuffer = gl.createBuffer();

  const positions = new Float32Array(config.particleCount * 2);
  const hues = new Float32Array(config.particleCount);
  const saturations = new Float32Array(config.particleCount);

  function getTextCoordinates(text) {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.canvas.width = canvas.width;
    ctx.canvas.height = canvas.height;
    const fontSize = Math.min(canvas.width / 6, canvas.height / 6);
    ctx.font = `900 ${fontSize}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const coordinates = [];
    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const index = (y * canvas.width + x) * 4;
        if (imageData[index + 3] > 128) {
          coordinates.push({
            x: (x / canvas.width) * 2 - 1,
            y: (y / canvas.height) * -2 + 1
          });
        }
      }
    }
    return coordinates;
  }

  function createParticles() {
    textCoordinates = getTextCoordinates(config.textArray[currentTextIndex]);
    for (let i = 0; i < config.particleCount; i++) {
      const randomIndex = Math.floor(Math.random() * textCoordinates.length);
      const { x, y } = textCoordinates[randomIndex];
      particles[i].x = particles[i].baseX = x;
      particles[i].y = particles[i].baseY = y;
    }
  }
  function updateParticles() {
    for (let i = 0; i < config.particleCount; i++) {
      const particle = particles[i];
      const dx = mouse.x - particle.x;
      const dy = mouse.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const forceDirectionX = dx / distance;
      const forceDirectionY = dy / distance;
      const maxDistance = mouse.radius;
      const force = (maxDistance - distance) / maxDistance;
      const directionX = forceDirectionX * force * config.forceMultiplier;
      const directionY = forceDirectionY * force * config.forceMultiplier;

      const angle = Math.atan2(dy, dx);

      const rotationForceX = Math.sin(
        -Math.cos(angle * -1) *
        Math.sin(config.rotationForceMultiplier * Math.cos(force)) *
        Math.sin(distance * distance) *
        Math.sin(angle * distance)
      );

      const rotationForceY = Math.sin(
        Math.cos(angle * 1) *
        Math.sin(config.rotationForceMultiplier * Math.sin(force)) *
        Math.sin(distance * distance) *
        Math.cos(angle * distance)
      );

      if (distance < mouse.radius) {
        particle.vx -= directionX + rotationForceX;
        particle.vy -= directionY + rotationForceY;
      } else {
        particle.vx += (particle.baseX - particle.x) * config.returnSpeed;
        particle.vy += (particle.baseY - particle.y) * config.returnSpeed;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= config.velocityDamping;
      particle.vy *= config.velocityDamping;

      const speed = Math.sqrt(
        particle.vx * particle.vx + particle.vy * particle.vy
      );
      const hue = (speed * config.colorMultiplier) % 360;

      hues[i] = hue / 360;
      saturations[i] = Math.min(speed * config.saturationMultiplier, 1);
      positions[i * 2] = particle.x;
      positions[i * 2 + 1] = particle.y;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, hueBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, hues, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, saturationBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, saturations, gl.DYNAMIC_DRAW);
  }

  function animate() {
    updateParticles();

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, hueBuffer);
    gl.vertexAttribPointer(hueAttributeLocation, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(hueAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, saturationBuffer);
    gl.vertexAttribPointer(saturationAttributeLocation, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(saturationAttributeLocation);
    gl.useProgram(program);
    gl.drawArrays(gl.POINTS, 0, config.particleCount);
    requestAnimationFrame(animate);
  }

  canvas.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / canvas.width) * 2 - 1;
    mouse.y = (event.clientY / canvas.height) * -2 + 1;
  });

  canvas.addEventListener("mouseleave", () => {
    mouse.x = -500;
    mouse.y = -500;
  });

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    createParticles();
  });

  function changeText() {
    currentTextIndex = (currentTextIndex + 1) % config.textArray.length;
    const newCoordinates = getTextCoordinates(config.textArray[currentTextIndex]);
    for (let i = 0; i < config.particleCount; i++) {
      const randomIndex = Math.floor(Math.random() * newCoordinates.length);
      const { x, y } = newCoordinates[randomIndex];
      particles[i].baseX = x;
      particles[i].baseY = y;
    }
    nextTextTimeout = setTimeout(changeText, config.textChangeInterval);
  }

  gl.clearColor(0, 0, 0, 0);
  createParticles();
  animate();
  nextTextTimeout = setTimeout(changeText, config.textChangeInterval);
}

$('body').css({
  'height': '100vh',
  'overflow': 'hidden'
})
setTimeout(() => {
  $('.section__loading').fadeOut();
  loading();
  $('body').css({
    'height': '100%',
    'overflow': 'auto'
  })
}, 100);


ScrollTrigger.create({
  trigger: ".section__text",
  pin: ".text-ani__wrap",
  start: 'top top',
  end: 'bottom bottom'
});
let textanis = gsap.utils.toArray("h2");
gsap.set(textanis, { yPercent: 100, opacity: 0});

textanis.forEach((textani, i) => {
  let isLast = i === textanis.length - 1; // 마지막 p인지 확인

  let tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".section__text",
      start: () => `top+=${i * window.innerHeight} top`,
      end: () => `top+=${(i + 1) * window.innerHeight} top`,
      scrub: true,
      onEnter: isLast ? () => { 
        setTimeout(() => {
          TypeHangul.type('.typing-ani', {
            intervalType: 80
          });
        }, 100);
      } : null,
    }
  });
  tl.to(textani, { yPercent: 0, opacity: 1})
  .to(textani, { yPercent: -100, opacity: 0}, "+=1")
});

window.addEventListener('load', init, false);
function init() {
  createWorld();
  createPrimitive();
  animation();
}
var scene, camera, renderer, container, mat, _primitive;
var start = Date.now();
var options = {
  perlin: {
    vel: 0.0148,
    speed: 0.00050,
    perlins: 1.0,
    decay: 0.01,
    complex: 0.30,
    waves: 8.0,
    eqcolor: 5.0,
    fragment: true,
    redhell: true,
  },
  spin: {
    sinVel: 0.0,
    ampVel: 45.0,
  },
};
function createWorld() {
  var _width = window.innerWidth;
  var _height = window.innerHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(55, _width / _height, 1, 1000);
  camera.position.z = 8;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(_width, _height);

  container = document.getElementById('bgService');
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    _width = window.innerWidth;
    _height = window.innerHeight;
    renderer.setSize(_width, _height);
    camera.aspect = _width / _height;
    camera.updateProjectionMatrix();
  });
}
function createPrimitive() {
  _primitive = new (function () {
    this.mesh = new THREE.Object3D();

    mat = new THREE.ShaderMaterial({
      wireframe: false,
      uniforms: {
        time: { type: "f", value: 0.0 },
        pointscale: { type: "f", value: 0.0 },
        decay: { type: "f", value: 0.0 },
        complex: { type: "f", value: 0.0 },
        waves: { type: "f", value: 0.0 },
        eqcolor: { type: "f", value: 0.0 },
        fragment: { type: "i", value: true },
        redhell: { type: "i", value: true },
      },
      vertexShader: document.getElementById("vertexShader").textContent,
      fragmentShader: document.getElementById("fragmentShader").textContent,
    });

    var geo = new THREE.IcosahedronBufferGeometry(3, 7);
    var mesh = new THREE.Points(geo, mat);
    this.mesh.add(mesh);
  })();

  scene.add(_primitive.mesh);
}
function animation() {
  requestAnimationFrame(animation);

  var performance = Date.now() * 0.003;
  _primitive.mesh.rotation.y += options.perlin.vel;
  _primitive.mesh.rotation.x =
    (Math.sin(performance * options.spin.sinVel) * options.spin.ampVel) *
    Math.PI /
    180;

  mat.uniforms["time"].value = options.perlin.speed * (Date.now() - start);
  mat.uniforms["pointscale"].value = options.perlin.perlins;
  mat.uniforms["decay"].value = options.perlin.decay;
  mat.uniforms["complex"].value = options.perlin.complex;
  mat.uniforms["waves"].value = options.perlin.waves;
  mat.uniforms["eqcolor"].value = options.perlin.eqcolor;
  mat.uniforms["fragment"].value = options.perlin.fragment;
  mat.uniforms["redhell"].value = options.perlin.redhell;

  camera.lookAt(scene.position);
  renderer.render(scene, camera);
}

let service = gsap.timeline({
  scrollTrigger: {
    trigger: ".section__service",
    pin: ".section__service",
    pinSpacing: true,
    start: "top top",
    end: "+=100%",
    scrub: 1,
    // markers: true,
  },
});
gsap.set('.section__service .bg', {
  opacity: 0,
});
service.to('.bg', {
  opacity: 1,
  duration: .1,
});
service.to('.service-box__wrap', {
  transform: 'translateY(-80%)',
  duration: 3,
});

let processAni = gsap.to(".process-ani", {
  xPercent: -100,
  ease: "none",
  scrollTrigger: {
    trigger: ".process-ani__wrap",
    start: "top 80%",
    end: "bottom center",
    scrub: 1,
  },
});


gsap.set(".process-list__wrap", {
  perspective: "900px",
});
gsap.to(".process-list__wrap li:nth-of-type(1)", {
  scale: 0.8,
  rotateX: "-10deg",
  backgroundColor: "#403f3f",
  immediateRender: true,
  scrollTrigger: {
    trigger: ".process-list__wrap li:nth-of-type(1)",
    start: "top 55%",
    endTrigger: ".process-list__wrap li:nth-of-type(3)",
    end: "top 0%",
    scrub: true,
    // markers: true,
  },
});

gsap.to(".process-list__wrap li:nth-of-type(2)", {
  scale: 0.85,
  rotateX: "-10deg",
  backgroundColor: "#403f3f",
  immediateRender: true,
  scrollTrigger: {
    trigger: ".process-list__wrap li:nth-of-type(2)",
    start: "top 50%",
    endTrigger: ".process-list__wrap li:nth-of-type(4)",
    end: "top 0%",
    scrub: true,
    // markers: true,
  },
});

gsap.to(".process-list__wrap li:nth-of-type(3)", {
  scale: 0.9,
  rotateX: "-10deg",
  backgroundColor: "#403f3f",
  immediateRender: true,
  scrollTrigger: {
    trigger: ".process-list__wrap li:nth-of-type(3)",
    start: "top 50%",
    endTrigger: ".process-list__wrap li:nth-of-type(4)",
    end: "top 0%",
    scrub: true,
    // markers: true,
  },
});
// });

gsap.to(".process-list__wrap li:nth-of-type(4)", {
  scale: 0.95,
  rotateX: "-10deg",
  backgroundColor: "#403f3f",
  immediateRender: true,
  scrollTrigger: {
    trigger: ".process-list__wrap li:nth-of-type(4)",
    start: "top 50%",
    end: "top 0%",
    scrub: true,
    // markers: true,
  },
});

let portfolio = document.querySelector('.portfolio-list__wrap');
let sections = gsap.utils.toArray(".portfolio-list");

let scrollPortfolio = gsap.to('.portfolio-list__wrap', {
  x: () => -(portfolio.scrollWidth - document.documentElement.clientWidth) + "px",
  ease: "none",
  scrollTrigger: {
    trigger: portfolio,
    pin: true,
    scrub: 1,
    start:"top top",
    end: () => "+=" + portfolio.offsetWidth,
    invalidateOnRefresh: true,
  }
});

ScrollTrigger.matchMedia({
  "(min-width: 992px)": function() {
    scrollPortfolio.scrollTrigger.enable();
  },
  "(max-width: 991px)": function() {
    scrollPortfolio.scrollTrigger.disable();
  }
});