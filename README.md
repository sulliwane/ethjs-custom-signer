# ethjs-custom-signer

## Changelog:

### unreleased:

- fix `eth_sign` callback(error, result) now follows the RPC Result specification `Result: { id, jsonrpc, result }`
- fix `personal_sign` callback(error, result) now follows the RPC Result specification `Result: { id, jsonrpc, result }`

### v1.1.1:

- add gasPrice option to overwrite eth_gasPrice estimation

### v1.1.0: breaking changes

- signMessage interface is now signMessage(address, data)
- signPersonalMessage interface is now signPersonalMessage(address, data)
