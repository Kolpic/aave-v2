# Mutuum Lending Provider Contracts

`.env` example file

```
MNEMONIC=
ALCHEMY_KEY=
ETHERSCAN_KEY=
```

## Build and deploy commands

### Docker commands

```bash
docker-compose build
```

```bash
docker-compose up -d
```

```bash
docker compose exec contracts-env bash
```

### Contract steps

Compile contracts

```bash
npm run compile
```

### Deploy steps

Deploy Address Provider Registry

```bash
npx hardhat full:deploy-address-provider-registry --network sepolia --pool Pyraxe
```

Deploy Address Provider

```bash
npx hardhat full:deploy-address-provider --network sepolia --pool Pyraxe
```

Deploy Lending Pool

```bash
npx hardhat full:deploy-lending-pool --network sepolia --pool Pyraxe
```

Deploy Oracles

```bash
npx hardhat full:deploy-oracles --network sepolia --pool Pyraxe
```

Deploy Data Provider

```bash
npx hardhat full:data-provider --network sepolia
```

Deploy WETH Gateway

```bash
npx hardhat full-deploy-weth-gateway --network sepolia --pool Pyraxe
```

Initialize Lending Pool

```bash
npx hardhat full:initialize-lending-pool --network sepolia --pool Pyraxe
```

Deploy Ui Pool Data Provider

```bash
npx hardhat deploy-UiPoolDataProviderV2V3 --network sepolia
```

Deploy Ui Incentive Data Provider

```bash
npx hardhat deploy-UiIncentiveDataProviderV2V3 --network sepolia
```
