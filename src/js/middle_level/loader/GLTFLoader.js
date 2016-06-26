import GLBoost from '../../globals';
import GLContext from '../../low_level/core/GLContext';
import Geometry from '../../low_level/geometries/Geometry';
import SkeletalGeometry from '../../low_level/geometries/SkeletalGeometry';
import ClassicMaterial from '../../low_level/ClassicMaterial';
import Mesh from '../meshes/Mesh';
import SkeletalMesh from '../meshes/SkeletalMesh';
import PhongShader from '../shaders/PhongShader';
import Texture from '../../low_level/textures/Texture';
import Vector3 from '../../low_level/math/Vector3';
import Vector2 from '../../low_level/math/Vector2';
import Vector4 from '../../low_level/math/Vector4';
import Matrix44 from '../../low_level/math/Matrix44';
import Quaternion from '../../low_level/math/Quaternion';
import ArrayUtil from '../../low_level/misc/ArrayUtil';
import Group from '../Group';
import Joint from '../../low_level/skeletons/Joint';


let singleton = Symbol();
let singletonEnforcer = Symbol();

/**
 * [en] This is a loader class of glTF file format. You can see more detail of glTF format at https://github.com/KhronosGroup/glTF .<br>
 * [ja] glTFファイルを読み込むためのローダークラスです。glTFファイルフォーマットについての詳細は https://github.com/KhronosGroup/glTF をご覧ください。
 */
export default class GLTFLoader {

  /**
   * [en] The constructor of GLTFLoader class. But you cannot use this constructor directly because of this class is a singleton class. Use getInstance() static method.<br>
   * [ja] GLTFLoaderクラスのコンストラクタです。しかし本クラスはシングルトンであるため、このコンストラクタは直接呼び出せません。getInstance()静的メソッドを使ってください。
   * @param {Symbol} enforcer [en] a Symbol to forbid calling this constructor directly [ja] このコンストラクタの直接呼び出しを禁止するためのシンボル
   */
  constructor(enforcer) {
    if (enforcer !== singletonEnforcer) {
      throw new Error("This is a Singleton class. get the instance using 'getInstance' static method.");
    }
  }

  /**
   * [en] The static method to get singleton instance of this class.<br>
   * [ja] このクラスのシングルトンインスタンスを取得するための静的メソッド。
   * @return {GLTFLoader} [en] the singleton instance of GLTFLoader class [ja] GLTFLoaderクラスのシングルトンインスタンス
   */
  static getInstance() {
    if (!this[singleton]) {
      this[singleton] = new GLTFLoader(singletonEnforcer);
    }
    return this[singleton];
  }

  /**
   * [en] the method to load glTF file.<br>
   * [ja] glTF fileをロードするためのメソッド。
   * @param {string} url [en] url of glTF file [ja] glTFファイルのurl
   * @param {number} scale [en] scale of size of loaded models [ja] 読み込んだモデルのサイズのスケール
   * @param {Shader} defaultShader [en] a shader to assign to loaded geometries [ja] 読み込んだジオメトリに適用するシェーダー
   * @param {HTMLCanvas|string} canvas [en] canvas or canvas' id string. [ja] canvasまたはcanvasのid文字列
   * @return {Promise} [en] a promise object [ja] Promiseオブジェクト
   */
  loadGLTF(url, scale = 1.0, defaultShader = null, canvas = GLBoost.CURRENT_CANVAS_ID) {
    return new Promise((resolve, reject)=> {
      var xmlHttp = new XMLHttpRequest();
      xmlHttp.onreadystatechange = ()=> {
        if (xmlHttp.readyState === 4 && (Math.floor(xmlHttp.status/100) === 2 || xmlHttp.status === 0)) {
          var gotText = xmlHttp.responseText;
          var partsOfPath = url.split('/');
          var basePath = '';
          for(var i=0; i<partsOfPath.length-1; i++) {
            basePath += partsOfPath[i] + '/';
          }
          console.log(basePath);
          this._constructMesh(gotText, basePath, canvas, scale, defaultShader, resolve);
        }
      };

      xmlHttp.open("GET", url, true);
      xmlHttp.send(null);
    });
  }

  _constructMesh(gotText, basePath, canvas, scale, defaultShader, resolve) {
    var json = JSON.parse(gotText);

    for (let bufferName in json.buffers) {
      //console.log("name: " + bufferName + " data:" + );
      let bufferInfo = json.buffers[bufferName];

      if ( bufferInfo.uri.match(/^data:application\/octet-stream;base64,/) ){
        this._loadBinaryFile(bufferInfo.uri, basePath, json, canvas, scale, defaultShader, resolve);
      } else {
        this._loadBinaryFileUsingXHR(basePath + bufferInfo.uri, basePath, json, canvas, scale, defaultShader, resolve);
      }
    }
  }

  _loadBinaryFile(dataUrI, basePath, json, canvas, scale, defaultShader, resolve) {
    dataUrI = dataUrI.split(',');
    var type = dataUrI[0].split(':')[1].split(';')[0];
    var byteString = atob(dataUrI[1]);
    var byteStringLength = byteString.length;
    var arrayBuffer = new ArrayBuffer(byteStringLength);
    var intArray = new Uint8Array(arrayBuffer);
    for (var i = 0; i < byteStringLength; i++) {
      intArray[i] = byteString.charCodeAt(i);
    }

    if (arrayBuffer) {
      this._IterateNodeOfScene(arrayBuffer, basePath, json, canvas, scale, defaultShader, resolve);
    }
  }

  _loadBinaryFileUsingXHR(binaryFilePath, basePath, json, canvas, scale, defaultShader, resolve) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", binaryFilePath, true);
    oReq.responseType = "arraybuffer";


    oReq.onload = (oEvent)=> {
      var arrayBuffer = oReq.response; // Note: not oReq.responseText

      if (arrayBuffer) {
        this._IterateNodeOfScene(arrayBuffer, basePath, json, canvas, scale, defaultShader, resolve);
      }
    };

    oReq.send(null);
  }

  _IterateNodeOfScene(arrayBuffer, basePath, json, canvas, scale, defaultShader, resolve) {
    let sceneJson = json.scenes.defaultScene;

    let group = new Group();
    group.userFlavorName = 'TopGroup';
    let nodeStr = null;
    for (let i=0; i<sceneJson.nodes.length; i++) {
      nodeStr = sceneJson.nodes[i];

      // iterate nodes and load meshes
      let element = this._recursiveIterateNode(nodeStr, arrayBuffer, basePath, json, canvas, scale, defaultShader)
      group.addChild(element);
    }

    // register joints hierarchy to skeletal mesh
    let skeletalMeshes = group.searchElementsByType(SkeletalMesh);
    skeletalMeshes.forEach((skeletalMesh)=>{
      var rootJoint = group.searchElement(skeletalMesh.rootJointName);
      skeletalMesh.jointsHierarchy = rootJoint;
    });

    // Animation
    this._loadAnimation(group, arrayBuffer, json, canvas, scale);

    resolve(group);
  }

  _recursiveIterateNode(nodeStr, arrayBuffer, basePath, json, canvas, scale, defaultShader) {
    var nodeJson = json.nodes[nodeStr];
    var group = new Group();
    group.userFlavorName = nodeStr;

    if (nodeJson.translation) {
      group.translate = new Vector3(nodeJson.translation[0], nodeJson.translation[1], nodeJson.translation[2]);
    }
    if (nodeJson.scale) {
      group.scale = new Vector3(nodeJson.scale[0], nodeJson.scale[1], nodeJson.scale[2]);
    }
    if (nodeJson.rotation) {
      group.quaternion = new Quaternion(nodeJson.rotation[0], nodeJson.rotation[1], nodeJson.rotation[2], nodeJson.rotation[3]);
    }
    if (nodeJson.matrix) {
      group.multiplyMatrix(new Matrix44(nodeJson.matrix, true));
    }

    if (nodeJson.meshes) {
      // this node has mashes...
      let meshStr = nodeJson.meshes[0];
      let meshJson = json.meshes[meshStr];

      let rootJointStr = null;
      let skinStr = null;
      if (nodeJson.skeletons) {
        rootJointStr = nodeJson.skeletons[0];
        skinStr = nodeJson.skin;
      }
      let mesh = this._loadMesh(meshJson, arrayBuffer, basePath, json, canvas, scale, defaultShader, rootJointStr, skinStr);
      mesh.userFlavorName = meshStr;
      group.addChild(mesh);
    } else if (nodeJson.jointName) {
      let joint = new Joint();
      joint.userFlavorName = nodeJson.jointName;
      group.addChild(joint);
    }

    for (let i=0; i<nodeJson.children.length; i++) {
      let nodeStr = nodeJson.children[i];
      let childElement = this._recursiveIterateNode(nodeStr, arrayBuffer, basePath, json, canvas, scale, defaultShader);
      group.addChild(childElement);
    }

    return group;
  }

  _loadMesh(meshJson, arrayBuffer, basePath, json, canvas, scale, defaultShader, rootJointStr, skinStr) {
    var mesh = null;
    var geometry = null;
    let gl = GLContext.getInstance(canvas).gl;
    if (rootJointStr) {
      geometry = new SkeletalGeometry(canvas);
      mesh = new SkeletalMesh(geometry, null, rootJointStr);
      let skin = json.skins[skinStr];

      mesh.multiplyMatrix(new Matrix44(skin.bindShapeMatrix, true));

      let inverseBindMatricesAccessorStr = skin.inverseBindMatrices;
      mesh.inverseBindMatrices = this._accessBinary(inverseBindMatricesAccessorStr, json, arrayBuffer, 1.0, gl);
    } else {
      geometry = new Geometry(canvas);
      mesh = new Mesh(geometry);
    }
    var material = new ClassicMaterial(canvas);

    let primitiveJson = meshJson.primitives[0];

    // Geometry
    let indicesAccessorStr = primitiveJson.indices;
    var indices = this._accessBinary(indicesAccessorStr, json, arrayBuffer, 1.0, gl);

    let positionsAccessorStr = primitiveJson.attributes.POSITION;
    let positions = this._accessBinary(positionsAccessorStr, json, arrayBuffer, scale, gl);

    let normalsAccessorStr = primitiveJson.attributes.NORMAL;
    let normals = this._accessBinary(normalsAccessorStr, json, arrayBuffer, 1.0, gl);

    var additional = {};

    /// if Skeletal
    let jointAccessorStr = primitiveJson.attributes.JOINT;
    if (jointAccessorStr) {
      let joints = this._accessBinary(jointAccessorStr, json, arrayBuffer, 1.0, gl);
      additional['joint'] = joints;
    }
    let weightAccessorStr = primitiveJson.attributes.WEIGHT;
    if (weightAccessorStr) {
      let weights = this._accessBinary(weightAccessorStr, json, arrayBuffer, 1.0, gl);
      additional['weight'] = weights;
    }

    // Texture
    let texcoords0AccessorStr = primitiveJson.attributes.TEXCOORD_0;
    var texcoords = null;

    let materialStr = primitiveJson.material;
    let materialJson = json.materials[materialStr];
    let diffuseValue = materialJson.values.diffuse;
    // Diffuse Texture
    if (texcoords0AccessorStr) {
      texcoords = this._accessBinary(texcoords0AccessorStr, json, arrayBuffer, 1.0, gl);
      additional['texcoord'] = texcoords;

      if (typeof diffuseValue === 'string') {
        let textureStr = diffuseValue;
        let textureJson = json.textures[textureStr];
        let imageStr = textureJson.source;
        let imageJson = json.images[imageStr];
        let imageFileStr = imageJson.uri;

        var texture = new Texture(basePath + imageFileStr, canvas);
        texture.name = textureStr;
        material.diffuseTexture = texture;
      }
    }
    // Diffuse
    if (diffuseValue && typeof diffuseValue !== 'string') {
      material.diffuseColor = new Vector4(diffuseValue[0], diffuseValue[1], diffuseValue[2], diffuseValue[3]);
    }
    // Ambient
    let ambientValue = materialJson.values.ambient;
    if (ambientValue && typeof ambientValue !== 'string') {
      material.ambientColor = new Vector4(ambientValue[0], ambientValue[1], ambientValue[2], ambientValue[3]);
    }
    // Specular
    let specularValue = materialJson.values.specular;
    if (specularValue && typeof specularValue !== 'string') {
      material.specularColor = new Vector4(specularValue[0], specularValue[1], specularValue[2], specularValue[3]);
    }

    let opacityValue = 1.0 - materialJson.values.transparency;

    var vertexData = {
      position: positions,
      normal: normals
    };

    geometry.setVerticesData(ArrayUtil.merge(vertexData, additional), [indices]);

    material.setVertexN(geometry, indices.length);
    if (defaultShader) {
      material.shaderClass = defaultShader;
    } else {
      material.shaderClass = PhongShader;
    }
    geometry.materials = [material];

    return mesh;
  }

  _loadAnimation(element, arrayBuffer, json, canvas, scale) {
    let animationJson = null;
    for (let anim in json.animations) {
      animationJson = json.animations[anim];
      if (animationJson) {
        for (let i=0; i<animationJson.channels.length; i++) {
          let channelJson = animationJson.channels[i];
          if (!channelJson) {
            continue;
          }

          let targetMeshStr = channelJson.target.id;
          let targetPathStr = channelJson.target.path;
          let samplerStr = channelJson.sampler;
          let samplerJson = animationJson.samplers[samplerStr];
          let animInputStr = samplerJson.input;
          var animOutputStr = samplerJson.output;
          let animInputAccessorStr = animationJson.parameters[animInputStr];
          let animOutputAccessorStr = animationJson.parameters[animOutputStr];

          let gl = GLContext.getInstance(canvas).gl;
          var animInputArray = this._accessBinary(animInputAccessorStr, json, arrayBuffer, 1.0, gl);
          if (animOutputStr === 'translation') {
            var animOutputArray = this._accessBinary(animOutputAccessorStr, json, arrayBuffer, scale, gl);
          } else if (animOutputStr === 'rotation') {
            var animOutputArray = this._accessBinary(animOutputAccessorStr, json, arrayBuffer, 1.0, gl, true);
          } else {
            var animOutputArray = this._accessBinary(animOutputAccessorStr, json, arrayBuffer, 1.0, gl);
          }

          let animationAttributeName = '';
          if (animOutputStr === 'translation') {
            animationAttributeName = 'translate';
          } else if (animOutputStr === 'rotation') {
            animationAttributeName = 'quaternion';
          } else {
            animationAttributeName = animOutputStr;
          }

          let hitElement = element.searchElement(targetMeshStr);
          if (hitElement) {
            hitElement.setAnimationAtLine('time', animationAttributeName, animInputArray, animOutputArray);
            hitElement.setActiveAnimationLine('time');
            hitElement.currentCalcMode = 'quaternion';
          }
        }
      }
    }
  }

  _accessBinary(accessorStr, json, arrayBuffer, scale, gl, quaternionIfVec4 = false) {
    var accessorJson = json.accessors[accessorStr];
    var bufferViewStr = accessorJson.bufferView;
    var bufferViewJson = json.bufferViews[bufferViewStr];
    var byteOffset = bufferViewJson.byteOffset + accessorJson.byteOffset;

    var componentN = 0;
    switch (accessorJson.type) {
      case 'SCALAR':
        componentN = 1;
        break;
      case 'VEC2':
        componentN = 2;
        break;
      case 'VEC3':
        componentN = 3;
        break;
      case 'VEC4':
        componentN = 4;
        break;
      case 'MAT4':
        componentN = 16;
        break;
    }

    var bytesPerComponent = 0;
    var dataViewMethod = '';
    switch (accessorJson.componentType) {
      case gl.UNSIGNED_SHORT:
        bytesPerComponent = 2;
        dataViewMethod = 'getUint16';
        break;
      case gl.FLOAT:
        bytesPerComponent = 4;
        dataViewMethod = 'getFloat32';
        break;
    }

    var byteLength = bytesPerComponent * componentN * accessorJson.count;

    var vertexAttributeArray = [];
    let dataView = new DataView(arrayBuffer, byteOffset, byteLength);
    let byteDelta = bytesPerComponent * componentN;
    let littleEndian = true;
    for (let pos = 0; pos < byteLength; pos += byteDelta) {

      switch (accessorJson.type) {
        case 'SCALAR':
          vertexAttributeArray.push(dataView[dataViewMethod](pos, littleEndian));
          break;
        case 'VEC2':
          vertexAttributeArray.push(new Vector2(
            dataView[dataViewMethod](pos, littleEndian)*scale,
            dataView[dataViewMethod](pos+bytesPerComponent, littleEndian)*scale
          ));
          break;
        case 'VEC3':
          vertexAttributeArray.push(new Vector3(
            dataView[dataViewMethod](pos, littleEndian)*scale,
            dataView[dataViewMethod](pos+bytesPerComponent, littleEndian)*scale,
            dataView[dataViewMethod](pos+bytesPerComponent*2, littleEndian)*scale
          ));
          break;
        case 'VEC4':
          if (quaternionIfVec4) {
            vertexAttributeArray.push(new Quaternion(
              dataView[dataViewMethod](pos, littleEndian),
              dataView[dataViewMethod](pos+bytesPerComponent, littleEndian),
              dataView[dataViewMethod](pos+bytesPerComponent*2, littleEndian),
              dataView[dataViewMethod](pos+bytesPerComponent*3, littleEndian)
            ));
          } else {
            vertexAttributeArray.push(new Vector4(
              dataView[dataViewMethod](pos, littleEndian)*scale,
              dataView[dataViewMethod](pos+bytesPerComponent, littleEndian)*scale,
              dataView[dataViewMethod](pos+bytesPerComponent*2, littleEndian)*scale,
              dataView[dataViewMethod](pos+bytesPerComponent*3, littleEndian)
            ));
          }
          break;
        case 'MAT4':
          let matrixComponents = [];
          for (let i=0; i<16; i++) {
            matrixComponents[i] = dataView[dataViewMethod](pos+bytesPerComponent*i, littleEndian)*scale;
          }
          vertexAttributeArray.push(new Matrix44(matrixComponents, true));
          break;
      }

    }

    return vertexAttributeArray;
  }

}



GLBoost["GLTFLoader"] = GLTFLoader;