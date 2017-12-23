# Simple Draco 3D

Wrapper for [draco3d](https://github.com/google/draco)

### Example
```js
var data = {
    indices: [0,1,2],
    attributes:{
        POSITION: [0,0,0, 1,0,0, 0,1,0]
    }
};

var encodedBuffer = SimpleDraco.encodeData(data);
var decodedMesh = SimpleDraco.decodeBuffer(encodedBuffer);
var decodedData = SimpleDraco.meshToData(decodedMesh);
```