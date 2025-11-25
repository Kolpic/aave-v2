// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol';
import '@pythnetwork/pyth-sdk-solidity/PythStructs.sol';
import {IPythFallbackOracle} from '../interfaces/IPythFallbackOracle.sol';

/**
 * @title PythFallbackOracle
 * @notice Fallback oracle using Pyth Network for price feeds
 * @dev Implements price feeds with configurable staleness checks
 * @author Pyraxe Protocol
 */
contract PythFallbackOracle is Ownable, IPythFallbackOracle {
  // ============ Storage ============
  // IPyth public immutable PYTH;
  AbstractPyth internal PYTH;

  // Mapping of asset pair -> Pyth price feed ID
  mapping(address => mapping(address => bytes32)) public priceFeeds;

  // Maximum allowed staleness (in seconds)
  uint256 public staleTime;
  uint256 private constant DEFAULT_STALE_TIME = 120;
  address public immutable WETH;
  address public immutable USDT;
  uint256 public constant PRECISION = 1e18;

  // ============ Constructor ============
  constructor(address pythAddress, uint256 initialStaleTime, address weth, address usdt) Ownable() {
    if (pythAddress == address(0)) revert InvalidPythAddress();
    if (weth == address(0) || usdt == address(0)) revert InvalidAssetAddress();
    PYTH = AbstractPyth(pythAddress);
    staleTime = initialStaleTime;
    WETH = weth;
    USDT = usdt;
  }

  // ============ Admin Functions ============
  /**
   * @dev Sets the maximum allowed staleness for price data
   * @param newStaleTime Maximum staleness in seconds (0 = no staleness check)
   */
  function setStaleTime(uint256 newStaleTime) external onlyOwner {
    uint256 oldStaleTime = staleTime;
    staleTime = newStaleTime;
    emit StaleTimeUpdated(oldStaleTime, newStaleTime);
  }

  /**
   * @dev Sets the Pyth price feed ID for an asset pair
   * @param assetFrom Source asset address
   * @param assetTo Target asset address
   * @param feedId Pyth price feed ID (use bytes32(0) to remove feed)
   */
  function setPriceFeed(address assetFrom, address assetTo, bytes32 feedId) external onlyOwner {
    if (assetFrom == address(0) || assetTo == address(0)) revert InvalidAsset();
    priceFeeds[assetFrom][assetTo] = feedId;
    emit PriceFeedSet(assetFrom, assetTo, feedId);
  }

  function setPythFallback(address pythFallbackOracle) external onlyOwner {
    if (pythFallbackOracle == address(0)) revert InvalidPythAddress();
    PYTH = AbstractPyth(pythFallbackOracle);
    emit PythFallbackSet(pythFallbackOracle);
  }

  // ============ Price Functions ============

  /**
   * @dev Calculates: (Asset/USD) / (ETH/USD) to return Asset/ETH.
   */
  function getAssetPrice(address asset) external view returns (uint256) {
    uint256 ethPriceInUsd = getPrice(WETH, USDT);

    uint256 assetPriceInUsd = getPrice(asset, USDT);

    return (assetPriceInUsd * PRECISION) / ethPriceInUsd;
  }

  /**
   * @dev Gets the price of assetFrom denominated in assetTo, scaled to assetTo's decimals
   * @param assetFrom Source asset address
   * @param assetTo Target asset address
   * @return price Price scaled to assetTo's decimals
   */
  function getPrice(address assetFrom, address assetTo) external view returns (uint256 price) {
    if (assetFrom == address(0) || assetTo == address(0)) revert InvalidAsset();

    bytes32 feedId = priceFeeds[assetFrom][assetTo];
    if (feedId == bytes32(0)) revert FeedNotSet();

    PythStructs.Price memory pythPrice = PYTH.getPriceNoOlderThan(feedId, staleTime);

    if (pythPrice.price <= 0) revert InvalidPrice();
    if (pythPrice.publishTime == 0) revert InvalidPrice();

    uint8 toDecimals = IERC20Metadata(assetTo).decimals();
    price = _convertPrice(uint256(int256(pythPrice.price)), pythPrice.expo, toDecimals);
  }

  // ============ Internal Functions ============
  /**
   * @dev Converts Pyth price to target asset decimals
   * @param price Pyth price (absolute value)
   * @param expo Pyth price exponent
   * @param targetDecimals Target asset decimals
   * @return convertedPrice Price in target asset decimals
   */
  function _convertPrice(
    uint256 price,
    int32 expo,
    uint8 targetDecimals
  ) internal pure returns (uint256 convertedPrice) {
    if (expo >= 0) {
      // Positive exponent: multiply by 10^(expo + targetDecimals)
      uint256 scale = 10 ** (uint256(int256(expo)) + uint256(targetDecimals));
      convertedPrice = price * scale;
    } else {
      // Negative exponent: divide by 10^(-expo) after multiplying by 10^targetDecimals
      uint256 numerator = price * (10 ** uint256(targetDecimals));
      uint256 denominator = 10 ** uint256(int256(-expo));
      convertedPrice = numerator / denominator;
    }
  }
}
