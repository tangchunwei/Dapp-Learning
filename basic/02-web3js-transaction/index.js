const Web3 = require('web3');
const fs = require('fs');
const contractOfIncrementer = require('./compile');

require('dotenv').config();
const privatekey = process.env.PRIVATE_KEY;

/*
   -- Define Provider --
*/
// Provider
const providerRPC = {
  // development: 'https://goerli.infura.io/v3/' + process.env.INFURA_ID,
  development: 'HTTP://127.0.0.1:7545',
  moonbase: 'https://rpc.testnet.moonbeam.network', //这个配置好像没有用到
};
const web3 = new Web3(providerRPC.development); //Change to correct network

// Create account with privatekey
const account = web3.eth.accounts.privateKeyToAccount(privatekey); //获取账号信息
const account_from = {
  privateKey: privatekey,
  accountAddress: account.address,
}; //获取账号信息

// Get abi & bin
const bytecode = contractOfIncrementer.evm.bytecode.object;
const abi = contractOfIncrementer.abi;

/*
*
*
*   -- Verify Deployment --
*

*/
const Trans = async () => {
  console.log('============================ 1. Deploy Contract');
  console.log(`Attempting to deploy from account ${account.address}`);

  // Create Contract Instance
  const deployContract = new web3.eth.Contract(abi);

  // Create Deployment Tx
  const deployTx = deployContract.deploy({
    data: bytecode,
    arguments: [5],
  }); //创建签名

  // Sign Tx
  const createTransaction = await web3.eth.accounts.signTransaction(
    {
      data: deployTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  ); //使用私钥对交易签名

  // Get Transaction Receipt
  const createReceipt = await web3.eth.sendSignedTransaction(
    createTransaction.rawTransaction
  );//部署合约
  console.log(`Contract deployed at address: ${createReceipt.contractAddress}`);

  const deployedBlockNumber = createReceipt.blockNumber;

  console.log(`部署的区块号是: ${deployedBlockNumber}`);

  /*
   *
   *
   *
   * -- Verify Interface of Increment --
   *
   *
   */
  // Create the contract with contract address
  // console.log();
  // console.log(
  //   '============================ 2. Call Contract Interface getNumber'
  // );
  let incrementer = new web3.eth.Contract(abi, createReceipt.contractAddress); //获取合约实例
  // console.log(incrementer)

  // console.log(
  //   `Making a call to contract at address: ${createReceipt.contractAddress}`
  // );

  let number = await incrementer.methods.getNumber().call(); //调用合约的getNumber方法
  console.log(`当前的数字是: ${number}`);

  // Add 3 to Contract Public Variable
  // console.log();
  // console.log(
  //   '============================ 3. Call Contract Interface increment'
  // );
  const _value = 3;
  let incrementTx = incrementer.methods.increment(_value); //调用合约的increment方法，增加3

  // Sign with Pk
  let incrementTransaction = await web3.eth.accounts.signTransaction(
    {
      to: createReceipt.contractAddress,
      data: incrementTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  ); //使用私钥对交易签名

  // Send Transactoin and Get TransactionHash
  const incrementReceipt = await web3.eth.sendSignedTransaction(
    incrementTransaction.rawTransaction
  ); //发送增加3的交易
  console.log(`发送交易成功，交易哈希为: ${incrementReceipt.transactionHash}`);

  number = await incrementer.methods.getNumber().call(); //再次调用合约的getNumber方法
  console.log(`After increment, the current number stored is: ${number}`);

  /*
   *
   *
   *
   * -- Verify Interface of Reset --
   *
   *
   */
  console.log();
  console.log('============================ 4. Call Contract Interface reset');
  const resetTx = incrementer.methods.reset(); //创建重置合约的交易

  const resetTransaction = await web3.eth.accounts.signTransaction(
    {
      to: createReceipt.contractAddress,
      data: resetTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  ); //使用私钥对重置数字的交易签名

  const resetcReceipt = await web3.eth.sendSignedTransaction(
    resetTransaction.rawTransaction
  ); //发送重置数字的交易
  console.log(`Tx successful with hash: ${resetcReceipt.transactionHash}`);
  number = await incrementer.methods.getNumber().call();
  console.log(`After reset, the current number stored is: ${number}`);

  /*
   *
   *
   *
   * -- Listen to Event Increment --
   *
   *
   */
  console.log();
  console.log('============================ 5. Listen to Events');
  console.log(' Listen to Increment Event only once && continuouslly');

  // goerli don't support http protocol to event listen, need to use websocket
  // more details , please refer to  https://medium.com/blockcentric/listening-for-smart-contract-events-on-public-blockchains-fdb5a8ac8b9a
  const web3Socket = new Web3(
    new Web3.providers.WebsocketProvider(
      // 'wss://goerli.infura.io/ws/v3/' + process.env.INFURA_ID
      'http://127.0.0.1:7545' //这里改回http获取，好像同时用websocket和http会出现问题
    )
  ); //创建websocket连接
  incrementer = new web3Socket.eth.Contract(abi, createReceipt.contractAddress); //获取合约实例

  // listen to  Increment event only once
  incrementer.once('Increment', (error, event) => {
    console.log('I am a onetime event listner, I am going to die now');
  }); //监听合约的事件，只监听一次

  // listen to Increment event continuously
  incrementer.events.Increment(() => {
    console.log('I am a longlive event listener, I get a event now');
  }); //监听合约的事件，一直监听

  for (let step = 0; step < 3; step++) {
    incrementTransaction = await web3.eth.accounts.signTransaction(
      {
        to: createReceipt.contractAddress,
        data: incrementTx.encodeABI(),
        gas: 8000000,
      },
      account_from.privateKey
    ); //循环对合约进行签名

    await web3.eth.sendSignedTransaction(incrementTransaction.rawTransaction); //循环发送交易

    if (step == 2) {
      // clear all the listeners
      web3Socket.eth.clearSubscriptions(); //清空所有的监听器
      console.log('清空所有的监听器');
    }
  }

  /*
   *
   *
   *
   * -- Get past events --
   *
   *
   */
  console.log();
  console.log('============================ 6. 获取过去的合约事件');
  const pastEvents = await incrementer.getPastEvents('Increment', {
    fromBlock: deployedBlockNumber,
    toBlock: 'latest',
  }); //获取过去的合约事件，从部署合约的区块到最新的区块

  pastEvents.map((event) => {
    console.log(event); //打印出过去的合约事件
  });

  /*
   *
   *
   *
   * -- Check Transaction Error --
   *
   *
   */
  console.log();
  console.log('============================ 7. Check the transaction error');
  incrementTx = incrementer.methods.increment(0); //估计发送一个错误的交易，增加0，这样子就会交易出错
  incrementTransaction = await web3.eth.accounts.signTransaction(
    {
      to: createReceipt.contractAddress,
      data: incrementTx.encodeABI(),
      gas: 8000000,
    },
    account_from.privateKey
  );

  await web3.eth
    .sendSignedTransaction(incrementTransaction.rawTransaction)
    .on('error', console.error); //发送错误的交易，然后监听错误
};

Trans()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
