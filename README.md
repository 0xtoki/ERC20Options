<h1 align="center">✨ ERC20 Options ✨</h1>
<h3 align="center">A decentralized application with solidity and react that allows users to lock in collateral to mint options (European) and exercise them in an ERC20 based contract.</h2>


## Setup contracts

```bash
yarn install
```

Setup ganache network in `hardhat.config.ts` and add private key to the env file


```bash
npx hardhat run --network ganache scripts/deploy.ts    
```

To initiate the first round of options, add the appropriate contract addresses in this file forto the option contract and the erc20 TST token

```bash
npx hardhat run --network ganache scripts/startOption.ts       
```

## Setup UI

```bash
cd client
```
```bash
yarn install && yarn dev
```

## Testing Contracts

```bash
yarn test
```



## License

The MIT License (MIT).
