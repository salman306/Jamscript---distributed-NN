jdata{
	struct NEURON_TASK {
      		int deviceId;
      		int problemId;
 		int neuronId;
		float bias;
 		char* weights;
 		char* inputs;
 	} NeuronTask as broadcaster;
 	struct NEURON_RESULT {
      		int problemId;
 		int neuronId;
 		float value;
 	} NeuronResult as logger;
 // 	struct PROBLEM_INPUTS {
 // 		int problemId;
 // 		int deviceId;
 // 		int networkId;
 // 		char* inputs;
 // 	} ProblemInput as logger;
	// struct PROBLEM_OUTPUTS {
 // 		int deviceId;
 // 		int result;
	// } ProblemOutput as broadcaster;
 }

var problems = {};
var problemTasks = {};
var problemInputBuffer = {};
var problemTaskBuffer = {};
var deviceList = [];
var deviceIterator = 0;
var deviceId = 0;
var problemIdIterator = 0;

/*
*		Helper Functions
*/

// jsync function to assign id's to devices
jsync function getId() {
    return ++deviceId;
}

jsync function getProblemId() {
	return ++problemIdIterator;
}

// Construct a task queue to carry out tasks
function constructTaskQueue(network) {
	var taskQueue = [];

	network["layers"].forEach(function(layer){
		var layerTask = [];
		layer["neurons"].forEach(function(neuron){
			neuron["completed"] = 0;
			layerTask.push(neuron);
		});
		taskQueue.push(layerTask);
	});
	return taskQueue;
}

// stringfy list
function stringfyList(list) {
	return "[" + list + "]";
}

// Initialize computing the next layer
function computeNextLayer(problemId) {
    if (this.problemTasks[problemId].length > 0) {
        var layerTasks = this.problemTasks[problemId].shift();
        problemTaskBuffer[problemId] = layerTasks
        layerTasks.forEach(function(neuron){
            var deviceId = getAvailableDevice();
            var inputs = this.problemInputBuffer[problemId];

            if (inputs.length !== neuron["weights"].length) {
                // throw an exception
            }
            // broadcast neuron task to a device
            inputBroadcaster({
                deviceId: deviceId,
                problemId: problemId,
                neuronId: neuron["id"],
		bias: neuron["bias"],
                weights: stringfyList(neuron["weights"]),
                inputs: stringfyList(inputs)
            });
        });
    }
    else {
        // logic for output
    }
}

// Get available device (simple implementation for now)
function getAvailableDevice() {
    var deviceId = this.deviceList[this.deviceIterator];
    if (this.deviceList.length > this.deviceIterator) {
        this.deviceIterator = this.deviceIterator + 1;
    }
    else {
        this.deviceIterator = 0;
    }
    return deviceId;
}

// Listener for new ML problem logger
var problemInputsListener = function (key, entry, device) {
	var networkId = entry.networkId;
	var network = require('../setup/network.json')["networks"][networkId];

	// add task to a problems dictionary - {problemId:deviceId}
	problems[entiry.problemId] = entry.deviceId;
	// Construct a task queue and buffer
	this.problemTasks[entry.problemId] = constructTaskQueue(network);
	this.problemInputBuffer[entry.problemId].push(entry.inputs);
	computeNextLayer();
};

var neuronResultListener = function (key, entry, device) {
    var layerCompleted = true;
    this.problemTaskBuffer[entry.problemId].forEach(function(task){
        if (task["id"] === entry.neuronId) {
            task["output"] = entry.value;
            task["completed"] = true;
        }
        if (task["completed"] !== 1) {
            layerCompleted = false;
        }
    });

    if (layerCompleted) {
        // initialize new input buffer for the next layer
        this.problemInputBuffer[entry.problemId] = [];
        this.problemTaskBuffer[entry.problemId].forEach(function(task){
            this.problemInputBuffer[entry.problemId].push(task["output"]);
        })

        computeNextLayer(entry.problemId);
    }
};

function inputBroadcaster (neuronTask) {
	NEURON_TASK.broadcast(neuronTask);
}

NEURON_RESULT.subscribe(neuronResultListener);

var fs = require('fs');
var arrayOfLines = fs.readFileSync('./sensor_readings_2.data').toString().split("\n").slice(0,100);

var testData = arrayOfLines.map(function(line){ return line.split(',') });
