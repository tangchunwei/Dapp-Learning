let Web3 = require('web3'); //导入web3 模块
let solc = require('solc'); //导入solc 模块
let fs = require('fs'); //导入fs 模块

// Get privatekey from environment
require('dotenv').config(); //导入dotenv 模块
const privatekey = process.env.PRIVATE_KEY; //从环境变量中获取私钥

// Load contract
const source = fs.readFileSync('Incrementer.sol', 'utf8'); //读取合约文件

// compile solidity
const input = { //定义待编译合约的格式
  language: 'Solidity',
  sources: {
    'Incrementer.sol': {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*'],
      },
    },
  },
};

const tempFile = JSON.parse(solc.compile(JSON.stringify(input))); //把合约转成字符串，然后编译，最后转成json格式
// console.log(tempFile)
const contractFile = tempFile.contracts['Incrementer.sol']['Incrementer']; //获取合约对象
// console.log(contractFile.evm)

// Get bin & abi
const bytecode = contractFile.evm.bytecode.object; //获取合约二进制码
const abi = contractFile.abi; //获取合约abi

// Create web3 with goerli provider，you can change goerli to other testnet
// const web3 = new Web3('https://goerli.infura.io/v3/' + process.env.INFURA_ID); //初始化web3对象，连接到goerli测试网络
const web3 = new Web3('HTTP://127.0.0.1:7545') //初始化web3对象，连接到本地ganache测试网络

// Create account from privatekey
const account = web3.eth.accounts.privateKeyToAccount(privatekey); //通过私钥获取账户对象
// console.log((account))
const account_from = {
  privateKey: privatekey,
  accountAddress: account.address,
}; //定义账户对象

/*
   -- Deploy Contract --
*/
const Deploy = async () => {
  // Create contract instance
  const deployContract = new web3.eth.Contract(abi); //根据abi创建合约实例

  // Create Tx
  const deployTx = deployContract.deploy({
    data: bytecode,
    arguments: [999], // 把构造函数传递过去
  });

  // Sign Tx
  const deployTransaction = await web3.eth.accounts.signTransaction(
    {
      data: deployTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  ); //对交易进行签名

  const deployReceipt = await web3.eth.sendSignedTransaction(deployTransaction.rawTransaction); //发送签名后的交易

  // Your deployed contrac can be viewed at: https://goerli.etherscan.io/address/${deployReceipt.contractAddress}
  // You can change goerli in above url to your selected testnet.
  console.log(`Contract deployed at address: ${deployReceipt.contractAddress}`);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
Deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
