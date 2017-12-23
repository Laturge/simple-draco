const draco3d = require('draco3d');

const decoderModule = draco3d.createDecoderModule({});
const encoderModule = draco3d.createEncoderModule({});

const attrs = {POSITION: 3, NORMAL: 3, COLOR: 3, TEX_COORD: 2};

const encoder = new encoderModule.Encoder();
const decoder = new decoderModule.Decoder();

var DEBUG = false;

encoder.SetSpeedOptions(5, 5);
encoder.SetAttributeQuantization(encoderModule.POSITION, 10);
encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);

function decodeBuffer(rawBuffer) {
    const buffer = new decoderModule.DecoderBuffer();

    buffer.Init(new Int8Array(rawBuffer), rawBuffer.byteLength);
    const geometryType = decoder.GetEncodedGeometryType(buffer);
  
    let mesh;
    let status;

    if (geometryType === decoderModule.TRIANGULAR_MESH) {
        mesh = new decoderModule.Mesh();
        status = decoder.DecodeBufferToMesh(buffer, mesh);
    } else if (geometryType === decoderModule.POINT_CLOUD) {
        mesh = new decoderModule.PointCloud();
        status = decoder.DecodeBufferToPointCloud(buffer, mesh);
    } else
        throw 'Error: Unknown geometry type';
    
    decoderModule.destroy(buffer);

    return mesh;
}

function meshToData(mesh) {
    const [numFaces, numPoints] = [mesh.num_faces(), mesh.num_points()];
    const indices = new Uint32Array(numFaces * 3);
    
    if (DEBUG)
        console.log('Number of faces ' + numFaces + ', Number of points:' + numPoints);

    const dracoIntArray = new decoderModule.DracoInt32Array();

    for (let i = 0, index=0; i < numFaces; ++i, index+=3) {
        decoder.GetFaceFromMesh(mesh, i, dracoIntArray);

        indices[index] = dracoIntArray.GetValue(0);
        indices[index + 1] = dracoIntArray.GetValue(1);
        indices[index + 2] = dracoIntArray.GetValue(2);
    }

    decoderModule.destroy(dracoIntArray);
    
    var attributes = [];

    Object.keys(attrs).forEach(attr => {
        const stride = attrs[attr];
        const numValues = numPoints * stride;
        const decoderAttr = decoderModule[attr];
        const attrId = decoder.GetAttributeId(mesh, decoderAttr);
  
        if (attrId < 0) {
            return;
        }

        if (DEBUG)
            console.log('Adding %s attribute', attr);
    
        const attribute = decoder.GetAttribute(mesh, attrId);
        const attributeData = new decoderModule.DracoFloat32Array();
  
        decoder.GetAttributeFloatForAllPoints(mesh, attribute, attributeData);
    
        attributes[attr] = new Float32Array(numValues);
  
        for (let i = 0; i < numValues; ++i) {
            attributes[attr][i] = attributeData.GetValue(i);
        }
    
        decoderModule.destroy(attributeData);
    });

    return { indices, attributes };
}

function encodeMesh(mesh) {
    
    let encodedData = new encoderModule.DracoInt8Array();
    
    if (DEBUG)
        console.log(`Encoding ${mesh.num_points()} points, ${mesh.num_faces()} faces ...`);
    
    const encodedLen = encoder.EncodeMeshToDracoBuffer(mesh,
        encodedData);
  
    encoderModule.destroy(mesh);
    
    if (encodedLen > 0) {
        if (DEBUG) 
            console.log('Encoded size is ' + encodedLen);
    }
    else
        throw 'Error: Encoding failed';
      
    const outputBuffer = new ArrayBuffer(encodedLen);
    const outputData = new Int8Array(outputBuffer);
  
    for (let i = 0; i < encodedLen; ++i) {
        outputData[i] = encodedData.GetValue(i);
    }
    encoderModule.destroy(encodedData);
      
    return Buffer(outputBuffer);
}

function encodeData({ indices, attributes }) {
    const meshBuilder = new encoderModule.MeshBuilder();
    const newMesh = new encoderModule.Mesh();
    const numPoints = attributes.POSITION.length / 3;
    const numFaces = indices.length / 3;

    if (numPoints % 1 !== 0)
        throw 'number of points is not an integer';
    if (numFaces % 1 !== 0)
        throw 'number of faces is not an integer';

    meshBuilder.AddFacesToMesh(newMesh, numFaces, indices);

    Object.keys(attrs).forEach((attr) => {
        const stride = attrs[attr];
        const encoderAttr = encoderModule[attr];

        if (!attributes[attr])
            return;
        
        meshBuilder.AddFloatAttributeToMesh(newMesh, encoderAttr, numPoints,
            stride, attributes[attr]);
    });
    encoderModule.destroy(meshBuilder);
  
    return encodeMesh(newMesh);
}

function destroy() {
    encoderModule.destroy(encoder);
    decoderModule.destroy(decoder);
}

module.exports = {
    setDebug(d) { DEBUG = d},
    encoder,
    decodeBuffer,
    encodeData,
    meshToData,
    destroy
}