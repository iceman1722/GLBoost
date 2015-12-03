import GLBoost from './globals'
import Vector3 from './math/Vector3'
import Matrix44 from './math/Matrix44'

export default class Element {
  constructor() {
    this.children = [];
    this._translate = Vector3.zero();
    this._rotate = Vector3.zero();
    this._scale = new Vector3(1, 1, 1);
    this._matrix = Matrix44.identity();
    this._dirty = false;
  }

  set translate(vec) {
    if (this._translate.isEqual(vec)) {
      return;
    }
    this._translate = vec;
    this._dirty = true;
  }

  get translate() {
    return this._translate;
  }

  set rotate(vec) {
    if (this._rotate.isEqual(vec)) {
      return;
    }
    this._rotate = vec;
    this._dirty = true;
  }

  get rotate() {
    return this._rotate;
  }

  set scale(vec) {
    if (this._scale.isEqual(vec)) {
      return;
    }
    this._scale = vec;
    this._dirty = true;
  }

  get scale() {
    return this._scale;
  }

  get transformMatrix() {
    if (this._dirty) {
      var matrix = Matrix44.identity();
      this._matrix = matrix.multiply(Matrix44.scale(this._scale)).
        multiply(Matrix44.rotateX(this._rotate.x)).
        multiply(Matrix44.rotateY(this._rotate.y)).
        multiply(Matrix44.rotateZ(this._rotate.z)).
        multiply(Matrix44.translate(this._translate));
      this._dirty = false;
      return this._matrix.clone();
    } else {
      return this._matrix.clone();
    }
  }

  set dirty(flg) {
    this._dirty = flg;
  }
}

GLBoost["Element"] = Element;
