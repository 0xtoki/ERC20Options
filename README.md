<h1 align="center">✨ ERC20 Options ✨</h1>
<h3 align="center">A decentralized application with solidity and react that allows users to lock in collateral to mint options (European) and exercise them in an ERC20 based contract.</h2>


## Setup contracts

```bash
yarn install
```

Setup ganache network in `hardhat.config.ts` and add private key to the env file. After deploying the contract addresses displayed in the terminal need to be added to each of the scripts used below and the .env.local file in the nextjs app located in the client folder


```bash
npx hardhat run --network ganache scripts/deploy.ts    
```

To initiate the first round of options

```bash
npx hardhat run --network ganache scripts/startOption.ts       
```
To force the option into the exercise window 
```bash
npx hardhat run --network ganache scripts/forceOpenExerciseWindow.ts   
```

To start the next epoch 

```bash
npx hardhat run --network ganache scripts/rolloverToNextEpoch.ts 
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
