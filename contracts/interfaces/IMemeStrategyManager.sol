// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IMemeStrategyManager {
   function addOwner(address owner) external;

   function addStrategy(address strategy) external;

   function removeStrategy(address strategy) external;

   function isStrategyblacklisted(address strategy) external view returns (bool);

   function viewblacklistedStrategies(uint256 cursor, uint256 size) external view returns (address[] memory, uint256);

   function viewCountblacklistedStrategies() external view returns (uint256);
}