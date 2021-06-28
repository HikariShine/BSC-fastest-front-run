const http = require('http');
const fs = require('fs');
const WebSocketServer = require('websocket').server;
const Tx = require('ethereumjs-tx');
const url = require('url');
const Web3 = require("web3");
const ethers = require('ethers');
const axios = require('axios')
const server_url = "http://localhost:9999"

/* client information */

var wallets  = [];
var donors   = [];  // register all donors each client wallets.

/* response */
var response = [];
var params   = [];
var responseJson;

//chainnet setting...

const web3 = new Web3(new Web3.providers.HttpProvider('https://quiet-lingering-pond.kovan.quiknode.pro/2124f88767ca59a449af38625328bcdb2d4b14a9/'));
const web3Ws = new Web3(new Web3.providers.WebsocketProvider('wss://quiet-lingering-pond.kovan.quiknode.pro/2124f88767ca59a449af38625328bcdb2d4b14a9/'));
const factory_address = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // uniswap factory.
const tokenIn = "0xd0a1e359811322d97991e03f863a0c30c2cf029c"; //WBNB address
const tokenOut = "0xaFF4481D10270F50f203E0763e2597776068CBc5"; //weeNus token
const minBnb=2;
const provider = new ethers.providers.WebSocketProvider('wss://quiet-lingering-pond.kovan.quiknode.pro/2124f88767ca59a449af38625328bcdb2d4b14a9/');

const factory = new ethers.Contract(
    factory_address,
    [
      'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
      'function getPair(address tokenA, address tokenB) external view returns (address pair)'
    ],
    provider
  );


  const erc = new ethers.Contract(
    tokenIn,
    [{"constant": true,"inputs": [{"name": "_owner","type": "address"}],"name": "balanceOf","outputs": [{"name": "balance","type": "uint256"}],"payable": false,"type": "function"}],
    provider
  );  

var initialLiquidityDetected = false;
var jmlBnb = 0;

const requestListener = function (req, res) {

    console.log("Receive wallet certification requests...");

    const queryObject = url.parse(req.url,true).query;


    console.log(queryObject.wallet);

    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    
    if (wallets.includes(queryObject.wallet)){
        console.log(queryObject.wallet + " is allowed. Now waiting for snipping and front running....\n");
        res.end(`{"result": true}`);
    } else {
        console.log(queryObject.wallet + " is not allowed. if you want to use it, please register into setting_wallet_list.txt\n");
        res.end(`{"result": false}`);
    }

};

async function checkIfValidWallet(message) {
    var string = String(message);
    var parseObj = JSON.parse(string);
    var subscriber = parseObj['msg']['subscriber'];
    let wallet_info = {wallet: subscriber};
    const params = new url.URLSearchParams(wallet_info);
    var res =  await axios.get(`${server_url}?${params}`);
    console.log("checkIfvalidate response..." + res.data.result);
    return res.data.result;
}


const server = http.createServer(requestListener);
server.listen(9999, () => {
    console.log("listening on 9999");
});
const wsServer = new WebSocketServer({
    httpServer: server
});

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

console.log('Checking Permitted Wallet address...\n')

wallets = processLineByLine();

console.log('\nlisten Pending transaction...\n');

wsServer.on('request', function(request) {

    const connection = request.accept(null, request.origin);

    connection.on('message', function(message) {

      if (!checkIfValidWallet(message.utf8Data)) {
        connection.sendUTF("Failed__Your wallet is not allowed to be used...");
      } else {

        console.log('Received Message:', message.utf8Data);

        donors.push.apply(donors, getDonors(message.utf8Data));
        // remove duplicates donors.
        donors = removeDuplicates(donors);

        /* Test Data  weenus
        connection.sendUTF(getBuyTestResponse());
        sleep(2000);
        connection.sendUTF(getSellTestResponse());
        */
  
       snipping_run(connection);
      
       web3Ws.eth
        .subscribe("pendingTransactions", function(error, result) {})
        .on("data", async function(transactionHash) {
      
          let transaction = await web3Ws.eth.getTransaction(transactionHash);
          let data = await handleTransaction(transaction);
  
          if (data != null) {
              //chainnet setting...
              params = data[1];
              response['net_name']  =  "kovan test";
              response['fee']       =   true; 
              response['tx_hash']   =   transactionHash;       
              response['from']      =   Web3.utils.toChecksumAddress(transaction['from']);
              response['to_addr']   =   Web3.utils.toChecksumAddress(transaction['to']);
              response['gas']       =   transaction['gas'];
              response['gas_price'] =   transaction['gas_price'];
              response['path'] = [];
              response['path'][0]   =   Web3.utils.toChecksumAddress(params[6]);   //in_token
              response['path'][1]  =   Web3.utils.toChecksumAddress(params[7]);   //out_token
              response['method']    =   data[0]; 
              response['status']    =   "pending";  
              response['in_token_amount'] =   params[0];
              response['in_token_amount_with_slippage'] =  response['in_token_amount'] * 0.95;
              response['out_token_amount'] =  params[1];
              response['out_token_amount_with_slippage'] = response['out_token_amount'] * 0.95;
  
              // parse json string ...
              responseJson = JSON.stringify(Object.assign({}, response));
              console.log(responseJson);
              connection.sendUTF(responseJson);
  
              while (await isPending(transaction['hash'])) { }
              await sleep(1000);
  
              response['path'][0]   =   Web3.utils.toChecksumAddress(params[7]);;   //in_token
              response['path'][1]  =   Web3.utils.toChecksumAddress(params[6]);;   //out_token
              response['method']    =   data[0]; 
              response['status']    =   "pending";  
              response['in_token_amount'] =   params[1];
              response['in_token_amount_with_slippage'] =  response['in_token_amount'] * 0.95;
              response['out_token_amount'] =  params[0];
              response['out_token_amount_with_slippage'] = response['out_token_amount'] * 0.95;
  
               // parse json string ...
              responseJson = JSON.stringify(Object.assign({}, response));
              console.log(responseJson);
              connection.sendUTF(responseJson);
  
          }
        });
      }

    });
    connection.on('close', function(reasonCode, description) {
        console.log('Client has disconnected.');
    });
});



async function snipping_run(connection){
    await checkLiq(connection);
}

async function checkLiq(connection) {

    console.log("checkLiq...");

    const pairAddressx = await factory.getPair(tokenIn, tokenOut);
    
    if (pairAddressx !== null && pairAddressx !== undefined) {
      // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
      if (pairAddressx.toString().indexOf('0x0000000000000') > -1) {
        
        return await snipping_run(connection);
      }
    }
    const pairBNBvalue = await erc.balanceOf(pairAddressx); 
    jmlBnb = await ethers.utils.formatEther(pairBNBvalue);
    console.log(`value BNB : ${jmlBnb}`);
  
    if(jmlBnb > minBnb){
        initialLiquidityDetected = true;
        // setTimeout(() => buyAction(), 3000);
        console.log("Find new liquidity...");
        connection.sendUTF(makeLiquidResponse());
        return await snipping_run(connection);
    }
    else{
        initialLiquidityDetected = false;
        console.log(' run again...');
        return await snipping_run(connection);
      }
}


async function handleTransaction(transaction) {
    console.log(transaction);
    if (transaction != null && donors.includes(transaction['from'] ) ) {
        console.log("Found pending transaction", transaction);
        console.log("pending: ", await isPending(transaction['hash']));
    } else {
        return null;
    }
    let data = parseTx(transaction['input']);
    console.log("parse Transaction Input data...", data);
    return data;
}

function makeLiquidResponse() {
    response['net_name']  =  "kovan test";
    response['fee']       =   false; 
    response['tx_hash']   =   "0x7fbf5393b663ac4939082822ca295cb1ae03badff1ec81c7f2a38ca30d3a0df0";       
    response['from']      =   Web3.utils.toChecksumAddress("0xa430dcf42247f2d3b0af1553f5cc7ca309a70580");
    response['to_addr']   =   Web3.utils.toChecksumAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    response['gas']       =   161010;
    response['gas_price'] =   6 * 10 ** 9;
    response['path'] = [];
    response['path'][0]   =   	Web3.utils.toChecksumAddress("0xd0A1E359811322d97991E03f863a0C30C2cF029C");   //in_token
    response['path'][1]  =   	Web3.utils.toChecksumAddress("0xaFF4481D10270F50f203E0763e2597776068CBc5");   //out_token weenus
    response['method']    =     0x414bf389; 
    response['status']    =   "pending";  
    response['in_token_amount'] =   99909606059852675;
    response['in_token_amount_with_slippage'] =  response['in_token_amount'] * 0.95;
    response['out_token_amount'] =  68887863015930451983;
    response['out_token_amount_with_slippage'] = response['out_token_amount'] * 0.95;

    // parse json string ...
    responseJson = JSON.stringify(Object.assign({}, response));

    console.log(response);
    console.log(responseJson);

    return responseJson;

}


function getBuyTestResponse(){

    response['net_name']  =  "kovan test";
    response['fee']       =   false; 
    response['tx_hash']   =   "0x7fbf5393b663ac4939082822ca295cb1ae03badff1ec81c7f2a38ca30d3a0df0";       
    response['from']      =   Web3.utils.toChecksumAddress("0xa430dcf42247f2d3b0af1553f5cc7ca309a70580");
    response['to_addr']   =   Web3.utils.toChecksumAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    response['gas']       =   161010;
    response['gas_price'] =   6 * 10 ** 9;
    response['path'] = [];
    response['path'][0]   =   	Web3.utils.toChecksumAddress("0xd0A1E359811322d97991E03f863a0C30C2cF029C");   //in_token
    response['path'][1]  =   	Web3.utils.toChecksumAddress("0xaFF4481D10270F50f203E0763e2597776068CBc5");   //out_token weenus
    response['method']    =     0x414bf389; 
    response['status']    =   "pending";  
    response['in_token_amount'] =   99909606059852675;
    response['in_token_amount_with_slippage'] =  response['in_token_amount'] * 0.95;
    response['out_token_amount'] =  68887863015930451983;
    response['out_token_amount_with_slippage'] = response['out_token_amount'] * 0.95;

    // parse json string ...
    responseJson = JSON.stringify(Object.assign({}, response));

    console.log(response);
    console.log(responseJson);

    return responseJson;
}

function getSellTestResponse(){

    response['net_name']  =  "kovan test";
    response['fee']       =   false; 
    response['tx_hash']   =   "0xd6d6bd2f01e6de359fc7b0a655d90f5ff7c9fafc8f67d632a1b7be181e03fbad";       
    response['from']      =   Web3.utils.toChecksumAddress("0xa430dcf42247f2d3b0af1553f5cc7ca309a70580");
    response['to_addr']   =   Web3.utils.toChecksumAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    response['gas']       =   161010;
    response['gas_price'] =   6 * 10 ** 9;
    response['path'] = [];
    response['path'][1]   =   	Web3.utils.toChecksumAddress("0xd0A1E359811322d97991E03f863a0C30C2cF029C");   //out_token weth
    response['path'][0]  =   	Web3.utils.toChecksumAddress("0xaFF4481D10270F50f203E0763e2597776068CBc5");   //in weenus
    response['method']    =     0x414bf389; 
    response['status']    =   "pending";  
    response['in_token_amount'] =   68887863015930451983;
    response['in_token_amount_with_slippage'] =  response['in_token_amount'] * 0.95;
    response['out_token_amount'] =  99909606059852675;
    response['out_token_amount_with_slippage'] = response['out_token_amount'] * 0.95;


    // parse json string ...
    responseJson = JSON.stringify(Object.assign({}, response));

    console.log(response);
    console.log(responseJson);

    return responseJson;
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
        let param;
        param = parseInt(input.substring(10 + 64 * i, 10 + 64 * (i + 1)), 16);
        if (i === 5 || i === 6 ) {
            // param = parseInt(param, 10);
        }
        params.push(param);
    }
    return [method, params]
}



function getDonors(message) {
    var string = String(message);
    var parseObj = JSON.parse(string);
    var donors = parseObj['msg']['donors'];
    return donors;
 }

 function processLineByLine() {
    var fs = require('fs');
    var array = fs.readFileSync('setting_wallet_list.txt').toString().split("\n");
    for(let i in array) {
        array[i] = array[i].replace(/(\r\n|\n|\r)/gm, "");
    }
    console.log(array);
    return array;
}

function removeDuplicates(data) {
    return [...new Set(data)]
}

async function logSave(message) {
    fs.appendFile('log_pending.txt', JSON.stringify(message) + "\n\n", function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
}

function getHashFromTransaction(stringValue) {
    var string = JSON.stringify(stringValue);
    var objectValue = JSON.parse(string);
    return objectValue['hash'];
 }

 function getFromAddressFromTransction(stringValue) {
    var string = JSON.stringify(stringValue);
    var objectValue = JSON.parse(string);
    return objectValue['from'];
 }

 async function getQuoteAmount(srcToken, destToken, srcQty) {
    // let quoteAmountRequest = await fetch(`${NETWORK_URL}/quote_amount?base=${srcToken}&quote=${destToken}&base_amount=${srcQty}&type=sell`)
    // let quoteAmount = await quoteAmountRequest.json();
    // quoteAmount = quoteAmount.data;
    // return quoteAmount * 0.97;
}


