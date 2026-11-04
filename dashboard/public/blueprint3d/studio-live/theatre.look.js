// The look shared by the scale theatre and the mesh preview: tone mapping, reflections, lights, contact
// shadow. One file, so a sculptor previewing a GLB alone sees it lit exactly as the theatre will light it.
//
// Classic script. Needs window.THREE (and window.THREE_ADDONS.RoomEnvironment for reflections); both are
// set by the module shim in theatre.html / mesh-preview.html before this runs.
(function () {
  /** Configure a renderer + scene: ACES filmic, sRGB out, PMREM room reflections, soft key/fill/rim. */
  function setup(T, renderer, scene, { exposure = 1.0 } = {}) {
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    const A = window.THREE_ADDONS || {};
    if (A.RoomEnvironment) {
      const pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new A.RoomEnvironment(renderer), 0.04).texture;
      pm.dispose();
    }
    const rig = new T.Group();
    rig.name = 'look:lights';
    rig.add(new T.HemisphereLight(0xf4f7ff, 0x6f665c, scene.environment ? 0.35 : 0.9));
    const key = new T.DirectionalLight(0xfff4e6, 1.6); key.position.set(2.6, 4.2, 3.2); rig.add(key);
    const fill = new T.DirectionalLight(0xdfe9ff, 0.45); fill.position.set(-3.4, 1.2, 2.4); rig.add(fill);
    const rim = new T.DirectionalLight(0xffffff, 1.1); rim.position.set(-1.2, 2.6, -4.2); rig.add(rim);
    scene.add(rig);
    return rig;
  }

  /** A soft contact shadow: a radial-gradient disc on the floor, no shadow maps needed. */
  function contactShadow(T, { radius = 1.8, opacity = 0.5, dark = false } = {}) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    const ink = dark ? '0,0,0' : '20,32,31';
    grd.addColorStop(0, `rgba(${ink},0.55)`); grd.addColorStop(0.45, `rgba(${ink},0.22)`); grd.addColorStop(1, `rgba(${ink},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const tex = new T.CanvasTexture(c);
    if ('colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry(radius * 2, radius * 2),
      new T.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.name = 'look:contact-shadow';
    m.renderOrder = -1;
    return m;
  }

  /** A GLTFLoader that can read the Draco-compressed GLBs build_mesh.py writes. */
  function loader() {
    const A = window.THREE_ADDONS || {};
    if (!A.GLTFLoader) return null;
    const l = new A.GLTFLoader();
    if (A.DRACOLoader) {
      const d = new A.DRACOLoader();
      d.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
      l.setDRACOLoader(d);
    }
    return l;
  }

  window.THEATRE_LOOK = { setup, contactShadow, loader };
})();
