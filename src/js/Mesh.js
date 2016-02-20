import GLBoost from './globals'
import Element from './Element'
import Vector3 from './math/Vector3'
import Vector4 from './math/Vector4'


export default class Mesh extends Element {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;

    if (this.__proto__.__proto__ && this.__proto__.__proto__.constructor == Mesh) {  // this code for tmlib
      Mesh._instanceCount = (typeof Mesh._instanceCount === "undefined") ? 0 : (Mesh._instanceCount + 1);
      this._instanceName = Mesh.name + '_' + Mesh._instanceCount;
    }
  }

  prepareForRender(existCamera_f, lights) {
    this._geometry.prepareForRender(existCamera_f, lights, this._material);
    if (this._geometry._materials.length === 0 && this._material) {
    //if (this._material) {
      this._material = this._geometry.prepareGLSLProgramAndSetVertexNtoMaterial(this._material, 0, existCamera_f, lights);
    }
  }

  draw(lights, camera, scene) {
    this._geometry.draw(lights, camera, this, scene);
  }

  set geometry(geometry) {
    this._geometry = geometry;
    geometry._parent = this;
    Mesh._geometries[geometry.toString()] = geometry;
  }

  get geometry() {
    return this._geometry;
  }

  set material(material) {
    /*
    if (typeof this._geometry === "undefined") {
      console.assert(false, "set a geometry before a material.");
    }
    if (this._geometry._materials.length === 0 && material) {
      this._geometry.materials = [material];
      this._material = material;
    } else {
      this._material = null;
    }
    */

    this._material = material;
  }

  get material() {
    return this._material;
  }

  bakeTransformToGeometry() {
    var positions = this._geometry._vertices.position;
    for (let i=0; i<positions.length; i++) {
      let mat = this.transformMatrixAccumulatedAncestry;
      let posVector4 = new Vector4(positions[i].x, positions[i].y, positions[i].z, 1);
      let transformedPosVec = mat.multiplyVector(posVector4);
      positions[i] = new Vector3(transformedPosVec.x, transformedPosVec.y, transformedPosVec.z);
    }
    this._geometry._vertices.position = positions;

    /*
    if (this._geometry._vertices.normal) {
      var normals = this._geometry._vertices.normal;
      for (let i=0; i<normals.length; i++) {
        let mat = this.transformMatrixAccumulatedAncestry;
        let normalVector4 = new Vector4(normals[i].x, normals[i].y, normals[i].z, 1);
        let transformedNormalVec = mat.multiplyVector(normalVector4);
        normals[i] = new Vector3(transformedNormalVec.x, transformedNormalVec.y, transformedNormalVec.z);
      }
      this._geometry._vertices.normal = normals;
    }
    */
  }

  bakeInverseTransformToGeometry() {
    var positions = this._geometry._vertices.position;
    for (let i=0; i<positions.length; i++) {
      let mat = this.inverseTransformMatrixAccumulatedAncestry;
      let posVector4 = new Vector4(positions[i].x, positions[i].y, positions[i].z, 1);
      let transformedPosVec = mat.multiplyVector(posVector4);
      positions[i] = new Vector3(transformedPosVec.x, transformedPosVec.y, transformedPosVec.z);
    }
    this._geometry._vertices.position = positions;

    /*
    if (this._geometry._vertices.normal) {
      var normals = this._geometry._vertices.normal;
      for (let i=0; i<normals.length; i++) {
        let mat = this.inverseTransformMatrixAccumulatedAncestry;
        let normalVector4 = new Vector4(normals[i].x, normals[i].y, normals[i].z, 1);
        let transformedNormalVec = mat.multiplyVector(normalVector4);
        normals[i] = new Vector3(transformedNormalVec.x, transformedNormalVec.y, transformedNormalVec.z);
      }
      this._geometry._vertices.normal = normals;
    }
    */
  }

  _copyMaterials() {
    if (this.geometry._indicesArray.length !== this.geometry._materials.length) {
      for (let i=0; i<this.geometry._indicesArray.length;i++) {
        this.geometry._materials[i] = this._material;//.clone();
        this.geometry._materials[i].setVertexN(this.geometry, this.geometry._indicesArray[i].length);
      }
    }
  }

  merge(meshOrMeshes) {
    if (Array.isArray(meshOrMeshes)) {
      this.bakeTransformToGeometry();

      let meshes = meshOrMeshes;
      for (let i=0; i<meshes.length; i++) {
        meshes[i].bakeTransformToGeometry();
        this.geometry.merge(meshes[i].geometry);
        delete meshes[i];
      }

      this._copyMaterials();

      this.bakeInverseTransformToGeometry();

    } else { //
      let mesh = meshOrMeshes;
      mesh.bakeTransformToGeometry();
      this.bakeTransformToGeometry();
      this.geometry.merge(mesh.geometry);

      this._copyMaterials();

      this.bakeInverseTransformToGeometry();
    }
  }

  mergeHarder(meshOrMeshes) {

    if (Array.isArray(meshOrMeshes)) {

      this.bakeTransformToGeometry();

      let meshes = meshOrMeshes;
      for (let i=0; i<meshes.length; i++) {
        meshes[i].bakeTransformToGeometry();
        this.geometry.mergeHarder(meshes[i].geometry);
        delete meshes[i];
      }

      this.bakeInverseTransformToGeometry();

    } else { //
      let mesh = meshOrMeshes;
      mesh.bakeTransformToGeometry();
      this.bakeTransformToGeometry();
      this.geometry.mergeHarder(mesh.geometry);

      this.bakeInverseTransformToGeometry();
    }
  }



}
Mesh._geometries = {};

GLBoost["Mesh"] = Mesh;
