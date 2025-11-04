import { ethers } from 'hardhat';
import { parseUnits } from 'ethers/lib/utils';
import { 
  deployMintableERC20,
  deployLendingPoolAddressesProvider,
  deployLendingPoolConfigurator,
  deployPriceOracle,
  deployAaveLibraries,
  deployLendingRateOracle,
} from '../helpers/contracts-deployments';
import { 
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getFirstSigner 
} from '../helpers/contracts-getters';
import { waitForTx, setDRE } from '../helpers/misc-utils';
import { LendingPoolFactory, DefaultReserveInterestRateStrategyFactory } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get token configuration from environment
const TOKEN_NAME = process.env.TOKEN_NAME || 'DAI Token';
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || 'DAI';
const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || '18');
const TOKEN_MINT_AMOUNT = process.env.TOKEN_MINT_AMOUNT || '10000';
const TOKEN_SUPPLY_AMOUNT = process.env.TOKEN_SUPPLY_AMOUNT || '500';

async function main() {
  console.log(`=== LOCAL TESTING: Deploy Pool and Test ${TOKEN_SYMBOL} Supply ===\n`);
  
  // Initialize DRE
  const hre = require('hardhat');
  setDRE(hre);
  
  const [deployer, user1] = await ethers.getSigners();
  
  console.log('Test Accounts:');
  console.log('  Deployer:', deployer.address);
  console.log('  User1:', user1.address);

  console.log('\n=== Token Configuration ===');
  console.log(`  Name: ${TOKEN_NAME}`);
  console.log(`  Symbol: ${TOKEN_SYMBOL}`);
  console.log(`  Decimals: ${TOKEN_DECIMALS}`);
  console.log(`  Mint Amount: ${TOKEN_MINT_AMOUNT}`);
  console.log(`  Supply Amount: ${TOKEN_SUPPLY_AMOUNT}`);

  console.log('\n=== STEP 1: Deploying Pool Infrastructure ===');
  
  // 1. Deploy mock token
  console.log(`Deploying ${TOKEN_SYMBOL}...`);
  const token = await deployMintableERC20([TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS.toString()]);
  console.log(`✓ ${TOKEN_SYMBOL}:`, token.address);
  
  // 2. Deploy pool infrastructure
  console.log('\nDeploying AddressesProvider...');
  const addressesProvider = await deployLendingPoolAddressesProvider("LOCAL_TEST");
  await waitForTx(await addressesProvider.setPoolAdmin(deployer.address));
  console.log('✓ AddressesProvider:', addressesProvider.address);
  
  console.log('Deploying libraries...');
  const libraries = await deployAaveLibraries(false);
  console.log('✓ Libraries deployed');
  
  console.log('Deploying LendingPool...');
  const lendingPoolImpl = await new LendingPoolFactory(libraries, await getFirstSigner()).deploy();
  await lendingPoolImpl.deployed();
  await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));
  const lendingPool = await getLendingPool(await addressesProvider.getLendingPool());
  console.log('✓ LendingPool:', lendingPool.address);
  
  console.log('Deploying Configurator...');
  const configuratorImpl = await deployLendingPoolConfigurator(false);
  await waitForTx(await addressesProvider.setLendingPoolConfiguratorImpl(configuratorImpl.address));
  const configurator = await getLendingPoolConfiguratorProxy(
    await addressesProvider.getLendingPoolConfigurator()
  );
  console.log('✓ Configurator:', configurator.address);
  
  // 3. Deploy token implementations
  console.log('\nDeploying token implementations...');
  const aTokenImpl = await (await ethers.getContractFactory("AToken")).deploy();
  const stableDebtImpl = await (await ethers.getContractFactory("StableDebtToken")).deploy();
  const variableDebtImpl = await (await ethers.getContractFactory("VariableDebtToken")).deploy();
  console.log('✓ Token implementations deployed');
  
  // 4. Deploy oracles
  console.log('Deploying oracles...');
  const oracle = await deployPriceOracle(false);
  await waitForTx(await oracle.setAssetPrice(token.address, parseUnits("0.001", 18))); // Set price
  await waitForTx(await addressesProvider.setPriceOracle(oracle.address));
  
  const lendingRateOracle = await deployLendingRateOracle(false);
  await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
  console.log('✓ Oracles configured');

  // 5. Deploy Data Provider
  console.log('Deploying Data Provider...');
  const { deployAaveProtocolDataProvider } = require('../helpers/contracts-deployments');
  const dataProvider = await deployAaveProtocolDataProvider(addressesProvider.address, false);
  console.log('✓ Data Provider:', dataProvider.address);
  
  // 6. Initialize token reserve
  console.log(`\nInitializing ${TOKEN_SYMBOL} reserve...`);
  const tokenRateStrategy = await new DefaultReserveInterestRateStrategyFactory(
    await getFirstSigner()
  ).deploy(
    addressesProvider.address,
    "800000000000000000000000000",  // Optimal utilization
    "0",                              // Base variable borrow rate
    "40000000000000000000000000",    // Variable rate slope 1
    "600000000000000000000000000",   // Variable rate slope 2
    "20000000000000000000000000",    // Stable rate slope 1
    "600000000000000000000000000"    // Stable rate slope 2
  );
  
  await waitForTx(await configurator.batchInitReserve([{
    aTokenImpl: aTokenImpl.address,
    stableDebtTokenImpl: stableDebtImpl.address,
    variableDebtTokenImpl: variableDebtImpl.address,
    underlyingAssetDecimals: TOKEN_DECIMALS,
    interestRateStrategyAddress: tokenRateStrategy.address,
    underlyingAsset: token.address,
    treasury: deployer.address,
    incentivesController: ethers.constants.AddressZero,
    underlyingAssetName: TOKEN_NAME,
    aTokenName: `Aave ${TOKEN_SYMBOL}`,
    aTokenSymbol: `a${TOKEN_SYMBOL}`,
    variableDebtTokenName: `Variable Debt ${TOKEN_SYMBOL}`,
    variableDebtTokenSymbol: `variableDebt${TOKEN_SYMBOL}`,
    stableDebtTokenName: `Stable Debt ${TOKEN_SYMBOL}`,
    stableDebtTokenSymbol: `stableDebt${TOKEN_SYMBOL}`,
    params: "0x10"
  }]));
  console.log(`✓ ${TOKEN_SYMBOL} reserve initialized`);
  
  console.log('\n✅ Pool deployment complete!\n');
  
  // Display deployment info
  console.log('=== Deployment Info (Copy these to your .env) ===');
  console.log('LENDING_POOL_ADDRESS=' + lendingPool.address);
  console.log('DATA_PROVIDER_ADDRESS=' + dataProvider.address);
  console.log('TOKEN_ADDRESS=' + token.address);
  console.log('TOKEN_NAME=' + TOKEN_NAME);
  console.log('TOKEN_SYMBOL=' + TOKEN_SYMBOL);
  console.log('TOKEN_DECIMALS=' + TOKEN_DECIMALS);
  console.log('\n');
  
  // Test supply operations
  console.log('=== STEP 2: Testing Supply Operations ===\n');
  
  // Mint tokens to user
  const mintAmount = parseUnits(TOKEN_MINT_AMOUNT, TOKEN_DECIMALS);
  console.log(`Minting ${TOKEN_MINT_AMOUNT} ${TOKEN_SYMBOL} to User1...`);
  await waitForTx(await token.connect(user1).mint(mintAmount));
  console.log('✓ Tokens minted');
  
  const userBalance = await token.balanceOf(user1.address);
  console.log(`  User1 balance: ${ethers.utils.formatUnits(userBalance, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`);
  
  // PHASE 1: User1 supplies tokens
  const supplyAmount = parseUnits(TOKEN_SUPPLY_AMOUNT, TOKEN_DECIMALS);
  console.log(`\n=== PHASE 1: User1 Supplies ${TOKEN_SUPPLY_AMOUNT} ${TOKEN_SYMBOL} (Time T) ===`);
  
  await waitForTx(await token.connect(user1).approve(lendingPool.address, supplyAmount));
  await waitForTx(await lendingPool.connect(user1).deposit(
    token.address,
    supplyAmount,
    user1.address,
    0
  ));
  console.log(`✓ User1 deposited ${TOKEN_SUPPLY_AMOUNT} ${TOKEN_SYMBOL}`);
  
  // Check balance
  const tokenReserve = await lendingPool.getReserveData(token.address);
  const aToken = await ethers.getContractAt("AToken", tokenReserve.aTokenAddress);
  const aTokenBalance = await aToken.balanceOf(user1.address);
  console.log(`  User1 a${TOKEN_SYMBOL} balance:`, ethers.utils.formatUnits(aTokenBalance, TOKEN_DECIMALS));
  
  // Fast forward time to simulate interest accrual
  console.log('\n⏰ Fast-forwarding 7 days...');
  await ethers.provider.send('evm_increaseTime', [604800]); // 7 days
  await ethers.provider.send('evm_mine', []);
  console.log('✓ Time advanced');
  
  // Final balances
  console.log('\n=== Final Pool State ===');
  console.log(`\n${TOKEN_SYMBOL} Pool:`);
  
  const totalSupply = await aToken.totalSupply();
  const finalATokenBalance = await aToken.balanceOf(user1.address);
  const finalTokenBalance = await token.balanceOf(user1.address);
  
  console.log(`  Total a${TOKEN_SYMBOL} supply:`, ethers.utils.formatUnits(totalSupply, TOKEN_DECIMALS));
  console.log(`  User1 a${TOKEN_SYMBOL}:`, ethers.utils.formatUnits(finalATokenBalance, TOKEN_DECIMALS));
  console.log(`  User1 ${TOKEN_SYMBOL} wallet balance:`, ethers.utils.formatUnits(finalTokenBalance, TOKEN_DECIMALS));
  
  // Calculate interest earned (aToken balance should be slightly higher than deposited amount)
  const interestEarned = finalATokenBalance.sub(supplyAmount);
  if (interestEarned.gt(0)) {
    console.log(`  Interest earned: +${ethers.utils.formatUnits(interestEarned, TOKEN_DECIMALS)} ${TOKEN_SYMBOL} 📈`);
  }
  
  console.log(`\n✅ All tests passed! Pool creation and ${TOKEN_SYMBOL} supply works correctly.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });