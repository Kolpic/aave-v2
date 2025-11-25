// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title IPythFallbackOracle
 * @notice Interface for the PythFallbackOracle contract
 * @dev Defines the interface for Pyth-based fallback oracle with configurable staleness checks
 * @author Pyraxe Protocol
 */
interface IPythFallbackOracle {
  // ============ Custom Errors ============
  error InvalidPythAddress();
  error FeedNotSet();
  error InvalidPrice();
  error PriceStale();
  error InvalidAsset();
  error InvalidAssetAddress();

  // ============ Events ============
  event StaleTimeUpdated(uint256 oldStaleTime, uint256 newStaleTime);
  event PriceFeedSet(address indexed assetFrom, address indexed assetTo, bytes32 indexed feedId);
  event PythFallbackSet(address indexed pythFallback);

  // ============ View Functions ============
  function staleTime() external view returns (uint256);

  function priceFeeds(address assetFrom, address assetTo) external view returns (bytes32);

  // ============ Admin Functions ============
  function setStaleTime(uint256 newStaleTime) external;

  function setPriceFeed(address assetFrom, address assetTo, bytes32 feedId) external;

  // ============ Price Functions ============
  function getPrice(address assetFrom, address assetTo) external view returns (uint256 price);
}
