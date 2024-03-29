// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import './ERC721A.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMemeMarketplace.sol";
import 'hardhat/console.sol';

contract Meme721 is ReentrancyGuard, ERC721A, Ownable {
   mapping(uint256 => string) private tokenURIs;
   address private fundAddress;
   address private routerAddress;
   address private marketplaceAddress;
   bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

   event minted(string _hash, uint256 _id);

   constructor (
      string memory name_, 
      string memory symbol_
   ) ERC721A(name_, symbol_) {
      fundAddress = _msgSender();
   }

   function setMarketplaceAddress(address marketplace_) external onlyOwner {
      marketplaceAddress = marketplace_;
   }

   function _setTokenURI(uint256 tokenID_, string memory tokenURI_) internal {
      tokenURIs[tokenID_] = tokenURI_;
   }

   function setFundAddress(address _addr) public onlyOwner {
		fundAddress = _addr;
	}

   function tokenURI(uint256 tokenID_) public view virtual override returns(string memory) {
	  require(_exists(tokenID_));
	  string memory _tokenURI = tokenURIs[tokenID_];
	  return _tokenURI;
   }

   function mintNFT(string[] memory tokenURIs_, address owner_) external nonReentrant {
      require (msg.sender == marketplaceAddress, 'no permission');
      uint256 quantity_ = tokenURIs_.length;

		uint256 newId = _currentIndex;
      uint256[] memory tokenIDs = new uint256[](quantity_);

		for (uint256 i = 0; i < quantity_; i++) {
			_setTokenURI(newId, tokenURIs_[i]);
			emit minted(tokenURIs_[i], newId);
         tokenIDs[i] = newId ++;
		}

      _safeMint(owner_, quantity_);

      IMemeMarketplace(marketplaceAddress).addCollection(
         owner_, address(this), tokenIDs
      );
   }

   function withdrawFund() public onlyOwner {
		uint256 balance = address(this).balance;
		require(balance > 0, "No fund to withdraw");

      address payable _to = payable(fundAddress);
      _to.transfer(balance);
	}

   receive() external payable {}
}