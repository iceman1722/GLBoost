import GLBoost from './../globals'
import Element from './../Element'
import GLContext from './../GLContext'
import GLExtentionsManager from './../GLExtentionsManager'
import Geometry from './../Geometry'
import Vector4 from './../math/Vector4'
import Vector3 from './../math/Vector3'
import Vector2 from './../math/Vector2'
import ArrayUtil from '.././misc/ArrayUtil'

export default class Plane extends Geometry {
  constructor(width, height, uSpan, vSpan, customVertexAttributes, canvas) {
    super(canvas);

    Plane._instanceCount = (typeof Plane._instanceCount === "undefined") ? 0 : (Plane._instanceCount + 1);

    this._setupVertexData(width, height, uSpan, vSpan, customVertexAttributes);
  }

  _setupVertexData(width, height, uSpan, vSpan, customVertexAttributes) {

    var positions = [];

    for(let i=0; i<=vSpan; i++) {
      for(let j=0; j<=uSpan; j++) {
        positions.push(new Vector3((j/uSpan - 1/2)*width, 0, (i/vSpan - 1/2)*height));
      }
    }

    var indices = [];
    for(let i=0; i<vSpan; i++) {
      let degenerate_left_index = 0;
      let degenerate_right_index = 0;
      for(let j=0; j<=uSpan; j++) {
        indices.push(i*(uSpan+1)+j);
        indices.push((i+1)*(uSpan+1)+j);
        if (j === 0) {
          degenerate_left_index = (i + 1) * (uSpan+1) + j;
        } else if (j === uSpan) {
          degenerate_right_index = (i + 1) * (uSpan+1) + j;
        }
      }
      indices.push(degenerate_right_index);
      indices.push(degenerate_left_index);
    }

    var colors = [];
    var vertexColor = new Vector4(1, 1, 1, 1);
    for(let i=0; i<=vSpan; i++) {
      for(let j=0; j<=uSpan; j++) {
        colors.push(vertexColor);
      }
    }

    var texcoords = [];
    for(let i=0; i<=vSpan; i++) {
      for(let j=0; j<=uSpan; j++) {
        texcoords.push(new Vector2(j/uSpan, i/vSpan));
      }
    }

    var normal = new Vector3(0, 1, 0);
    var normals = [];
    for(let i=0; i<=vSpan; i++) {
      for(let j=0; j<=uSpan; j++) {
        normals.push(normal);
      }
    }


    var object = {
      position: positions,
      color: colors,
      texcoord: texcoords,
      normal: normals,
      indices: [indices]
    };

    var completeAttributes = ArrayUtil.merge(object, customVertexAttributes);
    this.setVerticesData(completeAttributes, GLBoost.TRIANGLE_STRIP);
  }

  toString() {
    return 'Plane_' + Plane._instanceCount;
  }

}

GLBoost["Plane"] = Plane;