import M_PointLight from '../elements/lights/M_PointLight';
import M_DirectionalLight from '../elements/lights/M_DirectionalLight';
import Vector4 from '../../low_level/math/Vector4';
import Geometry from '../../low_level/geometries/Geometry';
import Shader from '../../low_level/shaders/Shader';

let singleton = Symbol();
let singletonEnforcer = Symbol();

export default class DrawKickerLocal {
  constructor(enforcer) {
    if (enforcer !== singletonEnforcer) {
      throw new Error('This is a Singleton class. get the instance using \'getInstance\' static method.');
    }
    this._glslProgram = null;
  }

  static getInstance() {
    if (!this[singleton]) {
      this[singleton] = new DrawKickerLocal(singletonEnforcer);
    }
    return this[singleton];
  }

  draw(gl, glem, expression, mesh, materials, camera, lights, scene, vertices, vaoDic, vboDic, iboArrayDic, geometry, geometryName, primitiveType, vertexN, renderPassIndex) {
    var isVAOBound = false;
    if (DrawKickerLocal._lastGeometry !== geometryName) {
      isVAOBound = glem.bindVertexArray(gl, vaoDic[geometryName]);
    }

    for (let i=0; i<materials.length;i++) {
      let material = materials[i];
      let materialUpdateStateString = material.getUpdateStateString();
      if (materialUpdateStateString !== DrawKickerLocal._lastMaterialUpdateStateString) {
        this._glslProgram = material.shaderInstance.glslProgram;
        gl.useProgram(this._glslProgram);
      }
      let glslProgram = this._glslProgram;

      if (!isVAOBound) {
        if (DrawKickerLocal._lastGeometry !== geometryName) {
          for (let attribName in vboDic) {
            gl.bindBuffer(gl.ARRAY_BUFFER, vboDic[attribName]);
            geometry.setUpVertexAttribs(gl, glslProgram, Geometry._allVertexAttribs(vertices));
          }
        }
      }

      let opacity = mesh.opacityAccumulatedAncestry * scene.opacity;
      gl.uniform1f(material.getUniform(glslProgram.hashId, 'opacity'), opacity);

      if (camera) {
        var viewMatrix = camera.lookAtRHMatrix();
        var projectionMatrix = camera.projectionRHMatrix();
        var world_m = mesh.transformMatrixAccumulatedAncestry;
        var pvm_m = projectionMatrix.multiply(viewMatrix).multiply(camera.inverseTransformMatrixAccumulatedAncestryWithoutMySelf).multiply(world_m);
        Shader.trySettingMatrix44ToUniform(gl, glslProgram.hashId, material, glslProgram._semanticsDic, 'MODELVIEW', Matrix44.multiply(viewMatrix, world_m.flatten()));
        Shader.trySettingMatrix44ToUniform(gl, glslProgram.hashId, material, glslProgram._semanticsDic, 'MODELVIEWPROJECTION',pvm_m.flatten());
      }

      if (material.getUniform(glslProgram.hashId, 'uniform_lightPosition_0')) {
        lights = material.shaderInstance.getDefaultPointLightIfNotExist(lights);
        if (material.getUniform(glslProgram.hashId, 'uniform_viewPosition')) {
          let cameraPosInLocalCoord = null;
          if (camera) {
            let cameraPos = camera.transformMatrixAccumulatedAncestryWithoutMySelf.multiplyVector(new Vector4(camera.eyeInner.x, camera.eyeInner.y, camera.eyeInner.z, 1.0));
            cameraPosInLocalCoord = mesh.inverseTransformMatrixAccumulatedAncestry.multiplyVector(new Vector4(cameraPos.x, cameraPos.y, cameraPos.z, 1));
          } else {
            cameraPosInLocalCoord = mesh.inverseTransformMatrixAccumulatedAncestry.multiplyVector(new Vector4(0, 0, 1, 1));
          }
          gl.uniform3f(material.getUniform(glslProgram.hashId, 'uniform_viewPosition'), cameraPosInLocalCoord.x, cameraPosInLocalCoord.y, cameraPosInLocalCoord.z);
        }

        for (let j = 0; j < lights.length; j++) {
          if (material.getUniform(glslProgram.hashId, `uniform_lightPosition_${j}`) && material.getUniform(glslProgram.hashId, `uniform_lightDiffuse_${j}`)) {
            let lightVec = null;
            let isPointLight = -9999;
            if (lights[j] instanceof M_PointLight) {
              lightVec = new Vector4(0, 0, 0, 1);
              lightVec = lights[j].transformMatrixAccumulatedAncestry.multiplyVector(lightVec);
              isPointLight = 1.0;
            } else if (lights[j] instanceof M_DirectionalLight) {
              lightVec = new Vector4(-lights[j].direction.x, -lights[j].direction.y, -lights[j].direction.z, 1);
              lightVec = lights[j].rotateMatrixAccumulatedAncestry.multiplyVector(lightVec);
              lightVec.w = 0.0;
              isPointLight = 0.0;
            }

            let lightVecInLocalCoord = mesh.inverseTransformMatrixAccumulatedAncestry.multiplyVector(lightVec);
            gl.uniform4f(material.getUniform(glslProgram.hashId, `uniform_lightPosition_${j}`), lightVecInLocalCoord.x, lightVecInLocalCoord.y, lightVecInLocalCoord.z, isPointLight);

            gl.uniform4f(material.getUniform(glslProgram.hashId, `uniform_lightDiffuse_${j}`), lights[j].intensity.x, lights[j].intensity.y, lights[j].intensity.z, 1.0);
          }
        }
      }

      let isMaterialSetupDone = true;

      if (material.shaderInstance.dirty || materialUpdateStateString !== DrawKickerLocal._lastMaterialUpdateStateString) {
        var needTobeStillDirty = material.shaderInstance.setUniforms(gl, glslProgram, expression, material, camera, mesh);
        material.shaderInstance.dirty = needTobeStillDirty ? true : false;
      }

      if (materialUpdateStateString !== DrawKickerLocal._lastMaterialUpdateStateString || DrawKickerLocal._lastRenderPassIndex !== renderPassIndex) {
        if (material) {
          isMaterialSetupDone = material.setUpTexture();
        }
      }
      if (!isMaterialSetupDone) {
        return;
      }

      if (geometry.isIndexed()) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboArrayDic[geometryName][i]);
        gl.drawElements(gl[primitiveType], material.getVertexN(geometry), glem.elementIndexBitSize(gl), 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      } else {
        gl.drawArrays(gl[primitiveType], 0, vertexN);
      }


      DrawKickerLocal._lastMaterialUpdateStateString = isMaterialSetupDone ? materialUpdateStateString : null;
    }

    //gl.bindBuffer(gl.ARRAY_BUFFER, null);

    DrawKickerLocal._lastGeometry = geometryName;
    DrawKickerLocal._lastRenderPassIndex = renderPassIndex;
  }
}

DrawKickerLocal._lastMaterialUpdateStateString = null;
DrawKickerLocal._lastGeometry = null;
DrawKickerLocal._lastRenderPassIndex = -1;
