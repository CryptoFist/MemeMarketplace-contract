// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./interfaces/IMemeCurrencyManager.sol";
import "./interfaces/IMemeStrategyManager.sol";

contract MemeMarketplace is Ownable, AccessControlEnumerable {
   using SafeERC20 for IERC20;

   IERC20 public immutable WETH;
   IMemeCurrencyManager private currencyManager;
   IMemeStrategyManager private strategyManager;
   address private fundAddress;

   bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
   bytes32 public constant MODERATE_ROLE = keccak256("MODERATE_ROLE");

   constructor(
      address currencyManager_,
      address strategyManager_,
      address WETH_,
      address multisig_
   ) {
      currencyManager = IMemeCurrencyManager(currencyManager_);
      strategyManager = IMemeStrategyManager(strategyManager_);
      WETH = IERC20(WETH_);
      fundAddress = msg.sender;
      _setupRole(OWNER_ROLE, msg.sender);
      _setupRole(OWNER_ROLE, multisig_);
   }

   function checkPermission() internal view {
      address sender = msg.sender;
      require (hasRole(OWNER_ROLE, sender) || hasRole(MODERATE_ROLE, sender), 'no permission');
   }

   function checkScammer() internal view {
      require (strategyManager.isStrategyblacklisted(msg.sender) == false, 'scammer address');
   }

   function setFundAddress(address fundAddress_) external onlyRole(OWNER_ROLE) {
      fundAddress = fundAddress_;
   }

   function addToBlackList(address user_) external {
      checkPermission();
      strategyManager.addStrategy(user_);
   }

   function removeFromBlackList(address user_) external {
      checkPermission();
      strategyManager.removeStrategy(user_);
   }

   function addCollection(address tokenAddress_) external {
      checkScammer();
      currencyManager.addCurrency(tokenAddress_);
   }

   function removeCollection(address tokenAddress_) external {
      checkPermission();
      currencyManager.removeCurrency(tokenAddress_);
   }

   function buyNFT(
      
   )

}