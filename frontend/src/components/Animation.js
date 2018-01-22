'use strict';
import React from 'react';
import autoBind from 'react-autobind';

import {
  Raycaster, Vector2, Vector3,
  WebGLRenderer, PerspectiveCamera,
  BoxGeometry,
  MeshFaceMaterial, MeshPhongMaterial, Mesh,
  AmbientLight, PointLight, DirectionalLight, Group, Scene, FaceColors, VertexColors, FaceNormalsHelper,
} from 'three';

import CustomTorusGeometry from "../geometry/CustomTorusGeometry";

/**
 * maybe solution to the memory leaks
 */
function disposeNode (node)
{
  if (node instanceof Mesh)
  {
    if (node.geometry)
    {
      node.geometry.dispose ();
    }

    if (node.material)
    {
      if (node.material instanceof MeshFaceMaterial)
      {
        node.material.materials.forEach((mtrl)=>
        {
          if (mtrl.map)           mtrl.map.dispose ();
          if (mtrl.lightMap)      mtrl.lightMap.dispose ();
          if (mtrl.bumpMap)       mtrl.bumpMap.dispose ();
          if (mtrl.normalMap)     mtrl.normalMap.dispose ();
          if (mtrl.specularMap)   mtrl.specularMap.dispose ()
          if (mtrl.envMap)        mtrl.envMap.dispose ();

          mtrl.dispose ();    // disposes any programs associated with the material
        });
      }
      else
      {
        if (node.material.map)          node.material.map.dispose ();
        if (node.material.lightMap)     node.material.lightMap.dispose ();
        if (node.material.bumpMap)      node.material.bumpMap.dispose ();
        if (node.material.normalMap)    node.material.normalMap.dispose ();
        if (node.material.specularMap)  node.material.specularMap.dispose ();
        if (node.material.envMap)       node.material.envMap.dispose ();

        node.material.dispose ();   // disposes any programs associated with the material
      }
    }
  }
}   // disposeNode

function disposeHierarchy (node, callback)
{
  for (let i = node.children.length - 1; i >= 0; i--)
  {
    let child = node.children[i];
    disposeHierarchy (child, callback);
    callback (child);
  }
}

/**
 * Our main class to display the torus. This only contains view code!
 */
class Animation {

  constructor(options) {
    autoBind(this);

    this.canvas = options.canvas;

    const width = options.width || 100;
    const height = options.height || 100;

    this.renderer = new WebGLRenderer({
      canvas: this.canvas
    });

    this.camera = new PerspectiveCamera(
      75,             // fov
      width / height, // aspect
      0.1,            // near
      1000            // far
    );
    this.camera.position.set(5, 0, 0);
    this.camera.lookAt(new Vector3(0, 0, 0));

    this.stoneGeometry = new BoxGeometry(0.1,0.1,0.1);
    this.customTorusGeometry = new CustomTorusGeometry(
      2,   // radius
      1.5, // thickness
      19,   // XSegments
      19    // YSegments
    );

    this.blackStoneMaterial = new MeshPhongMaterial({color: 0x333333});
    this.whiteStoneMaterial = new MeshPhongMaterial({color: 0xcccccc});
    this.torusMaterial = new MeshPhongMaterial({ color: 0xffffff, vertexColors: FaceColors });
    //this.torusMaterial.wireframe = true;

    this.stoneMeshes = [];
    this.torusMesh = new Mesh(this.customTorusGeometry, this.torusMaterial);

    this.light = {
      ambient: new AmbientLight(0x333333),
      point: new PointLight(0x000000),
      directional: new DirectionalLight(0x555555)
    };

    this.color_timer = 0;
    this.light.point.position.set(0, 0, 0);
    this.light.directional.position.set(1,0,0).normalize();

    this.torusGroup = new Group();
    this.torusGroup.add(this.torusMesh);

    this.raycaster = new Raycaster();
    this.cursor = new Vector2();

    this.scene = new Scene();
    this.scene.add(this.torusGroup);
    this.scene.add(this.light.ambient);
    this.scene.add(this.light.point);
    this.scene.add(this.light.directional);
    this.scene.add(this.camera);

    this.playing = false;

    this.delta = {
      x: 0,
      y: 0,
      z: 0,
      twist: 0,
      zoom: 0
    };

    //this.helper = new FaceNormalsHelper( this.torusMesh, 0.5, 0x00ff00, 1 );

    //this.scene.add( this.helper );
  }

  start() {
    if(!this.playing) {
      this.playing = true;
      this.animate();
    }
  }

  stop() {
    cancelAnimationFrame(this.animationHandler);
    this.playing = false;
    this.renderer.dispose();
    while(this.scene.children.length > 0){
      disposeHierarchy(this.scene.children[0], disposeNode);
      this.scene.remove(this.scene.children[0]);
    }
  }

  reset() {
    this.torusGroup.rotation.set(0,0,0);
    this.customTorusGeometry.parameters.twist = 0.0;
  }

  setSize(width, height) {
    this.renderer.setSize(width, height);
    this.camera.aspect = width/height;
    this.camera.updateProjectionMatrix();
  }

  setDelta(delta) {
    this.delta = delta;
  }

  setCursor(cursor) {
    this.cursor.set(
      cursor.x * 2 / this.renderer.getSize().width - 1,
      -cursor.y * 2 / this.renderer.getSize().height + 1
    );
  }

  setBoardState(boardState) {
    this.boardState = boardState;
  }

  updateRotation() {
    const DELTA_X = 0.1;
    const DELTA_Y = 0.1;
    const DELTA_Z = 0.05;

    let pos = this.camera.position;
    let up = this.camera.up;

    let x = (new Vector3()).crossVectors(up, pos).normalize();
    let y = up;

    pos.addScaledVector(x, this.delta.x * DELTA_X);
    pos.addScaledVector(y, this.delta.y * DELTA_Y);

    pos.normalize();

    let newNormal = pos.clone();

    pos.multiplyScalar(5);

    let diff = newNormal.multiplyScalar(up.dot(newNormal));

    up.sub(diff).normalize();

    this.light.directional.position.copy(pos);

    this.camera.lookAt(new Vector3(0, 0, 0));

    up.applyAxisAngle(pos.clone().normalize(), this.delta.z * DELTA_Z);
  }

  updateTwist() {
    const DELTA_TWIST = 0.1;
    if(this.delta.twist) {
      this.customTorusGeometry.parameters.twist += this.delta.twist * DELTA_TWIST;
      this.customTorusGeometry.updateGeometry();
      //this.helper.update();
    }
  }

  updateStones() {
    if (typeof this.boardState === 'undefined') return;

    // clean up old stones
    this.stoneMeshes.forEach((stoneMesh) => {
      this.scene.remove(stoneMesh);
    });
    this.stoneMeshes = [];

    let nonempty = 0;
    let vId = 0;
    for (let i = 0; i < this.customTorusGeometry.parameters.XSegments; i++) {
      for (let j = 0; j < this.customTorusGeometry.parameters.YSegments; j++) {
        let field = this.boardState[vId];

        if (field.isEmpty()) {
        } else if (field.isBlack()) {
          nonempty++;
          let newStone = new Mesh(this.stoneGeometry, this.blackStoneMaterial);
          this.stoneMeshes.push(newStone);
          newStone.position.copy(this.customTorusGeometry.quads[vId].position);
          this.scene.add(newStone)
        } else {
          nonempty++;
          let newStone = new Mesh(this.stoneGeometry, this.whiteStoneMaterial);
          this.stoneMeshes.push(newStone);
          newStone.position.copy(this.customTorusGeometry.quads[vId].position);
          this.scene.add(newStone)
        }
        vId++;
      }
    }
  }

  updateRaycast() {
    this.raycaster.setFromCamera(this.cursor, this.camera);

    let intersects = this.raycaster.intersectObject( this.torusMesh);

    if(intersects.length > 0) {
      intersects[0].face.quad.setColor( Math.random(), Math.random(), Math.random() );
      this.customTorusGeometry.colorsNeedUpdate = true;
    }
  }

  animate() {
    this.animationHandler = requestAnimationFrame(this.animate);

    //Start of animation code

    this.updateRotation();
    this.updateTwist();
    this.updateStones();
    this.updateRaycast();

    //End of animation code

    this.renderer.render(this.scene, this.camera);
  }
}

export default Animation;