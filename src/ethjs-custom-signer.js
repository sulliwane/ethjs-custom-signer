const Debug = require('debug');
const HTTPProvider = require('ethjs-provider-http');
const EthRPC = require('ethjs-rpc');

const debug = Debug('ethjs-iexec-signer');
/**
 * Signer provider constructor
 *
 * @method SignerProvider
 * @param {String} path the input data payload
 * @param {Object} options the send async callback
 * @returns {Object} provider instance
 */
function SignerProvider(path, options) {
  if (!(this instanceof SignerProvider)) {
    throw new Error(
      '[ethjs-provider-signer] the SignerProvider instance requires the "new" flag in order to function normally (e.g. `const eth = new Eth(new SignerProvider(...));`).',
    );
  }
  if (typeof options !== 'object') {
    throw new Error(
      `[ethjs-provider-signer] the SignerProvider requires an options object be provided with the 'privateKey' property specified, you provided type ${typeof options}.`,
    );
  }
  if (typeof options.signTransaction !== 'function') {
    throw new Error(
      `[ethjs-provider-signer] the SignerProvider requires an options object be provided with the 'signTransaction' property specified, you provided type ${typeof options.privateKey} (e.g. 'const eth = new Eth(new SignerProvider("http://ropsten.infura.io", { privateKey: (account, cb) => cb(null, 'some private key') }));').`,
    );
  }

  const self = this;

  const txQueue = [];
  let processingTxQueue = false;
  const processQueue = async () => {
    if (processingTxQueue) {
      debug('already processing txQueue');
      return;
    }
    processingTxQueue = true;
    const tx = txQueue.shift();
    if (!tx) {
      debug('txQueue is empty');
      processingTxQueue = false;
      return;
    }
    debug('processing 1 tx remaining', txQueue.length);
    const { payload, callback } = tx;
    try {
      const nonce = await new Promise((resolve, reject) => self.sendAsync(
        {
          id: payload.id + 1,
          jsonrpc: payload.jsonrpc,
          method: 'eth_getTransactionCount',
          params: [payload.params[0].from, 'pending'],
        },
        (error, result) => {
          if (error) reject(error);
          else if (result.error) reject(result.error);
          else resolve(result.result);
        },
      ));
      debug('nonce', nonce);

      const txToSign = Object.assign({}, payload.params[0], {
        nonce,
      });
      debug('txToSign', txToSign);

      const signedRawTx = await self.options.signTransaction(txToSign);

      const outputPayload = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        method: 'eth_sendRawTransaction',
        params: [signedRawTx],
      };
      await new Promise((resolve) => {
        self.provider.sendAsync(outputPayload, (error, result) => resolve(callback(error, result)));
      });
    } catch (e) {
      callback(e);
    }
    processingTxQueue = false;
    processQueue();
  };

  self.options = Object.assign(
    {
      provider: HTTPProvider,
    },
    options,
  );
  self.timeout = options.timeout || 0;
  self.provider = new self.options.provider(path, self.timeout); // eslint-disable-line
  self.rpc = new EthRPC(self.provider);
  self.addTxToQueue = (tx) => {
    txQueue.push(tx);
    processQueue();
  };
}

/**
 * Send async override
 *
 * @method sendAsync
 * @param {payload} payload the input data payload
 * @param {Function} callback the send async callback
 * @callback {Object} output the XMLHttpRequest payload
 */
SignerProvider.prototype.sendAsync = async function sendAsync(
  payload,
  callback,
) {
  try {
    debug('payload', payload);
    const self = this;
    if (payload.method === 'eth_accounts' && self.options.accounts) {
      const accounts = await self.options.accounts();
      // create new output payload
      const outputPayload = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: accounts,
      };
      callback(null, outputPayload);
    } else if (
      payload.method === 'eth_getTransactionCount'
      && self.options.getTransactionCount
    ) {
      debug('eth_getTransactionCount overwrite getTransactionCount');
      const outputPayload = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: await self.options.getTransactionCount(...payload.params),
      };
      callback(null, outputPayload);
    } else if (payload.method === 'eth_gasPrice' && self.options.gasPrice) {
      debug(`eth_gasPrice overwrite ${self.options.gasPrice}`);
      const outputPayload = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: self.options.gasPrice,
      };
      callback(null, outputPayload);
    } else if (payload.method === 'eth_sendTransaction') {
      const [gasPrice, estimateGas] = await Promise.all([
        new Promise((resolve, reject) => self.sendAsync(
          {
            id: payload.id + 1,
            jsonrpc: payload.jsonrpc,
            method: 'eth_gasPrice',
          },
          (error, result) => {
            if (error) reject(error);
            else if (result.error) reject(result.error);
            else resolve(result.result);
          },
        )),
        self.rpc.sendAsync({
          method: 'eth_estimateGas',
          params: [payload.params[0]],
        }),
      ]);
      debug('estimateGas', estimateGas);
      debug('gasPrice', gasPrice);

      const rawTxPayload = Object.assign({
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        params: [
          Object.assign(
            {
              gasPrice,
              gasLimit: estimateGas,
            },
            payload.params[0],
          ),
        ],
      });
      // add to tx queue
      self.addTxToQueue({ payload: rawTxPayload, callback });
    } else if (payload.method === 'eth_signTypedData') {
      const signedData = await self.options.signTypedData(payload.params[0]);
      callback(null, {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: signedData,
      });
    } else if (payload.method === 'eth_signTypedData_v3') {
      const signedData = await self.options.signTypedDatav3(
        payload.params[0],
        payload.params[1],
      );
      callback(null, {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: signedData,
      });
    } else if (payload.method === 'eth_sign') {
      const signedData = await self.options.signMessage(
        payload.params[0],
        payload.params[1],
      );
      callback(null, {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: signedData,
      });
    } else if (payload.method === 'personal_sign') {
      const signedData = await self.options.signPersonalMessage(
        payload.params[0],
        payload.params[1],
      );
      callback(null, {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: signedData,
      });
    } else {
      self.provider.sendAsync(payload, callback);
    }
  } catch (error) {
    debug('sendAsync()', error);
    callback(error, null);
  }
};

module.exports = SignerProvider;
