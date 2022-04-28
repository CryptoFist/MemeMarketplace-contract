// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./interfaces/IMemeStrategyManager.sol";

contract MemeStrategyManager is OwnableUpgradeable, AccessControlEnumerableUpgradeable, IMemeStrategyManager {
   using EnumerableSet for EnumerableSet.AddressSet;

   EnumerableSet.AddressSet private blacklistedStrategies;
   bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

   function initialize() public initializer {
      __Ownable_init();
      _setupRole(OWNER_ROLE, msg.sender);
   }

   function addOwner(address owner_) external onlyOwner override {
      _setupRole(OWNER_ROLE, owner_);
   }

   function addStrategy(address strategy_) external onlyRole(OWNER_ROLE) override {
      require(!blacklistedStrategies.contains(strategy_), "Strategy: Already blacklisted");
      blacklistedStrategies.add(strategy_);
   }

   function removeStrategy(address strategy_) external onlyRole(OWNER_ROLE) override {
      require(blacklistedStrategies.contains(strategy_), "Strategy: Not blacklisted");
      blacklistedStrategies.remove(strategy_);
   }

   function isStrategyblacklisted(address strategy_) external view override returns (bool) {
      return blacklistedStrategies.contains(strategy_);
   }

   function viewCountblacklistedStrategies() external view override returns (uint256) {
      return blacklistedStrategies.length();
   }

   function viewblacklistedStrategies(
      uint256 cursor_, 
      uint256 size_
   ) external view override returns (address[] memory, uint256) {
      uint256 length = size_;

      if (length > blacklistedStrategies.length() - cursor_) {
         length = blacklistedStrategies.length() - cursor_;
      }

      address[] memory strategies = new address[](length);

      for (uint256 i = 0; i < length; i++) {
         strategies[i] = blacklistedStrategies.at(cursor_ + i);
      }

      return (strategies, cursor_ + length);
   }
}