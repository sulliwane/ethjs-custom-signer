# ethjs-custom-signer

## Changelog:

### v1.3.0:

- add `getTransactionCount(address, block)` option to override `eth_getTransactionCount`. Allow custom nonce management.
- `eth_sendTransaction` now pushes transactions into a queue and sends them sequentially.

### v1.2.0: breaking changes

- overwrite `eth_gasPrice` not only for transactions
- fix `eth_sign` callback(error, result) now follows the RPC Result specification `Result: { id, jsonrpc, result }`
- fix `personal_sign` callback(error, result) now follows the RPC Result specification `Result: { id, jsonrpc, result }`

### v1.1.1:

- add `gasPrice` option to override `eth_gasPrice` estimation

### v1.1.0: breaking changes

- signMessage interface is now signMessage(address, data)
- signPersonalMessage interface is now signPersonalMessage(address, data)
