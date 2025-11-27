import { task } from 'hardhat/config';
import { eContractid, eNetwork } from '../../helpers/types';
import { deployPythOracle, deployFeeCollector } from '../helpers/contracts-deployments';
import { insertContractAddressInDb, getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig } from '../../helpers/configuration';
import { waitForTx } from '../../helpers/misc-utils';

task('deploy-pyraxe-pyth-oracle', 'Deploys the Pyraxe Pyth Fallback Oracle')
  .addFlag('verify', 'Verify contract at Etherscan')
  .addParam('pool', 'Pool configuration name')
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const pythConfig = poolConfig.PythOracle[network];
    console.log('-> Deploying Pyraxe Pyth Fallback Oracle...');

    if (!pythConfig || !pythConfig.wethAddress || !pythConfig.usdtAddress) {
      throw new Error(
        `Pyth Oracle configuration (WETH/USDT/PythAddress) missing for network: ${network}`
      );
    }

    const { pythAddress, initialStaleTime, wethAddress, usdtAddress, priceFeeds } = pythConfig;

    console.log('-> Deploying Pyraxe Pyth Fallback Oracle...');
    console.log(`   Pyth Address: ${pythAddress}`);
    console.log(`   Stale Time: ${initialStaleTime}`);
    console.log(`   WETH: ${wethAddress}`);
    console.log(`   USDT: ${usdtAddress}`);

    const pythOracle = await deployPythOracle(
      [pythAddress, initialStaleTime, wethAddress, usdtAddress],
      verify
    );
    await insertContractAddressInDb(eContractid.PythOracle, pythOracle.address);
    console.log(`\tPyth Oracle deployed at: ${pythOracle.address}`);

    if (priceFeeds && priceFeeds.length > 0) {
      console.log('\n-> Configuring Price Feeds from Config...');

      for (const feed of priceFeeds) {
        if (!feed.asset || !feed.base || !feed.feedId) {
          console.warn(`Skipping invalid feed config for ${feed.symbol}`);
          continue;
        }

        console.log(`   Setting ${feed.symbol} -> USDT Feed...`);
        console.log(`     Asset: ${feed.asset}`);
        console.log(`     Base:  ${feed.base}`);
        console.log(`     ID:    ${feed.feedId}`);

        await waitForTx(await pythOracle.setPriceFeed(feed.asset, feed.base, feed.feedId));
      }
    } else {
      console.log('\n-> No price feeds configured in commons.ts to set.');
    }

    console.log('\n-> Pyth Oracle Configuration Complete!');
    return pythOracle.address;
  });

task('deploy-pyraxe-feecollector', 'Deploys the Pyraxe Fee Collector')
  .addFlag('verify', 'Verify contract at Etherscan')
  .addParam('pool', 'Pool configuration name')
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { admin, guardian, withdrawer } = poolConfig.FeeCollector[network];

    console.log('-> Deploying Pyraxe Fee Collector...');
    const feeCollector = await deployFeeCollector([admin, guardian, withdrawer], verify);
    await insertContractAddressInDb(eContractid.FeeCollector, feeCollector.address);
    console.log(`\tFee Collector deployed at: ${feeCollector.address}`);

    return feeCollector.address;
  });
