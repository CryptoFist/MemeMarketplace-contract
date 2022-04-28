// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./interfaces/IMemeCurrencyManager.sol";

contract MemeCurrencyManager is OwnableUpgradeable, AccessControlEnumerableUpgradeable, IMemeCurrencyManager {
   using EnumerableSet for EnumerableSet.AddressSet;

   EnumerableSet.AddressSet private whitelistedCurrencies;
   bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

   function initialize() public initializer {
      __Ownable_init();
      _setupRole(OWNER_ROLE, msg.sender);
   }

   function addOwner(address owner_) external override onlyOwner {
      _setupRole(OWNER_ROLE, owner_);
   }

   function addCurrency(address currency) external override onlyRole(OWNER_ROLE) {
      require(!whitelistedCurrencies.contains(currency), "Currency: Already whitelisted");
      whitelistedCurrencies.add(currency);
   }

   function removeCurrency(address currency) external override onlyRole(OWNER_ROLE) {
      require(whitelistedCurrencies.contains(currency), "Currency: Not whitelisted");
      whitelistedCurrencies.remove(currency);
   }

   function isCurrencyWhitelisted(address currency) external view override returns (bool) {
      return whitelistedCurrencies.contains(currency);
   }

   function viewCountWhitelistedCurrencies() external view override returns (uint256) {
      return whitelistedCurrencies.length();
   }

   function viewWhitelistedCurrencies(
      uint256 cursor, 
      uint256 size
   ) external view override returns (address[] memory, uint256)
   {
      uint256 length = size;

      if (length > whitelistedCurrencies.length() - cursor) {
         length = whitelistedCurrencies.length() - cursor;
      }

      address[] memory currencies = new address[](length);

      for (uint256 i = 0; i < length; i++) {
         currencies[i] = whitelistedCurrencies.at(cursor + i);
      }

      return (currencies, cursor + length);
   }
}