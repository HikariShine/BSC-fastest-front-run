const http = require('http');
const fs = require('fs');
const WebSocketServer = require('websocket').server;
const Tx = require('ethereumjs-tx')
const Web3 = require("web3");
const server = http.createServer();
server.listen(9999);
const wsServer = new WebSocketServer({
    httpServer: server
});

var donors;
var response = []; 
var params = [];
var responseJson;

//chainnet setting...

const web3 = new Web3(new Web3.providers.HttpProvider('https://kovan.infura.io/ws/v3/8827667c483640e699955a604e6280e4'));
const web3Ws = new Web3(new Web3.providers.WebsocketProvider('wss://kovan.infura.io/ws/v3/8827667c483640e699955a604e6280e4'));

console.log('listen Pending transaction...');
wsServer.on('request', function(request) {
    const connection = request.accept(null, request.origin);
    connection.on('message', function(message) {
      console.log('Received Message:', message.utf8Data);
      donors = getDonors(message.utf8Data);
    //   connection.sendUTF('Low Balance');
    web3Ws.eth
      .subscribe("pendingTransactions", function(error, result) {})
      .on("data", async function(transactionHash) {
        console.log(transactionHash);
        let transaction = await web3.eth.getTransaction(transactionHash);
        let data = await handleTransaction(transaction);

        if (data != null) {
            //chainnet setting...
            params = data[1];
            response['net_name']  =  "kovan test";
            response['fee']       =   true; 
            response['tx_hash']   =   transactionHash;       
            response['from']      =   transaction['from'];
            response['to_addr']   =   transaction['to'];
            response['gas']       =   transaction['gas'];
            response['gas_price'] =   transaction['gas_price'];
            response['path'][0]   =   params[0];   //in_token
            response['path'][-1]  =   params[2];   //out_token
            response['method']    =   data[0]; 
            response['status']    =   "pending";  
            response['in_token_amount'] =   params[1];
            response['in_token_amount_with_slippage'] =  params[1] * 0.95;
            response['out_token_amount'] =  params[3];
            response['out_token_amount_with_slippage'] = params[3] * 0.95;

            // parse json string ...
            // responseJson = 
            console.log(response);
            connection.sendUTF(response);

            while (await isPending(transaction['hash'])) { }

            response['path'][0]   =   params[2];   //in_token
            response['path'][-1]  =   params[0];   //out_token
            response['method']    =   data[0]; 
            response['status']    =   "confirmed";  
            response['in_token_amount'] =   params[3];
            response['in_token_amount_with_slippage'] =  params[3] * 0.95;
            response['out_token_amount'] =  params[1];
            response['out_token_amount_with_slippage'] = params[1] * 0.95;

             // parse json string ...
            // responseJson = 
            console.log(response);
            connection.sendUTF(response);

        }
      });

    });
    connection.on('close', function(reasonCode, description) {
        console.log('Client has disconnected.');
    });
});


async function getQuoteAmount(srcToken, destToken, srcQty) {
    // let quoteAmountRequest = await fetch(`${NETWORK_URL}/quote_amount?base=${srcToken}&quote=${destToken}&base_amount=${srcQty}&type=sell`)
    // let quoteAmount = await quoteAmountRequest.json();
    // quoteAmount = quoteAmount.data;
    // return quoteAmount * 0.97;
}


async function handleTransaction(transaction) {
    console.log(transaction);
    if (donors.includes(transaction['from'] ) && await isPending(transaction['hash'])) {
        console.log("Found pending transaction", transaction);
    } else {
        return null;
    }
    let data = parseTx(transaction['input']);
    console.log("parse Transaction Input data...", data);
    return data;

}

async function isPending(transactionHash) {
    return await web3.eth.getTransactionReceipt(transactionHash) == null;
}

function parseTx(input) {
    if (input == '0x') {
        return ['0x', []]
    }
    if ((input.length - 8 - 2) % 64 != 0) {
        throw "Data size misaligned with parse request."
    }
    let method = input.substring(0, 10);
    let numParams = (input.length - 8 - 2) / 64;
    var params = [];
    for (let i = 0; i < numParams; i += 1) {
        let param = parseInt(input.substring(10 + 64 * i, 10 + 64 * (i + 1)), 16);
        params.push(param);
    }
    return [method, params]
}


async function logSave(message) {
    fs.appendFile('log_pending.txt', JSON.stringify(message) + "\n\n", function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
}

function getHash(stringValue) {
    var string = JSON.stringify(stringValue);
    var objectValue = JSON.parse(string);
    return objectValue['hash'];
 }

 function getFrom(stringValue) {
    var string = JSON.stringify(stringValue);
    var objectValue = JSON.parse(string);
    return objectValue['from'];
 }

 function getDonors(message) {
    var string = String(message);
    var parseObj = JSON.parse(string);
    var donors = parseObj['msg']['donors'];
    return donors;
 }


