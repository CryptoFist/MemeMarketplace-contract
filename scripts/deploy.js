/**
 * NFT address is 0x966dC3Fd635f7BE39Ab8162207Fd56A6e884D148
 * RevFactory address is 0x0f0782765FbC636Dc020914E5B7698156904ca25
 * RevSale address is  0x6A439F9a4C3B0a5349108bC29c8b6FD3E85e2567
 * RevAuction address is  0x9D193AFc23EEC7EFB179807B41ec090a5965F8DA
 * marketplace address is  0xF45831366eD2D8E963C8D5671d85BE3b9D9ce0F0
 * router address is 0x20C57729FAFE3F5b0c7c801A38fe43A475dFAB71
 */
const { parseEther } = require('ethers/lib/utils');
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');

const moderates = [
   '0x46F5F2BF5950e98c82a09789888f89709eb8973C',
   '0xEb722FCC2Ca5b12B20bBDf87cf23F474465908c6',
   '0xa96872aa8CBb429CdC52A750fBe160E7c7ce45FB',
   '0xE407d30Df833B0fF2A543BC0B72Fda274293c26A',
   '0x9aa2d68dD4729Cd0e05b9f4734051cceF15F2A9E',
   '0x47D5713B73aDEad0b0C90D34826C01bf360E622b',
   '0xF62bCd6A25B1e871bc50A02A107c8F30De73FE77',
   '0x01d6bAcD18AEC39E2fC52b992fcFA3201E9E4d43',
   '0x0aDAEd5C76351FC8539B9ca94B600C190A283a91',
   '0xe52ea470087A2803bA57BBCAbB6418A249F2708C'
];

async function main() {

   const [deployer] = await ethers.getSigners();

   console.log("Deploying contracts with the account:", deployer.address);

   const WETH_address = 0xc778417e063141139fce010982780140aa0cd5ab; // rinkeby

   this.revNFT = await deploy('RevNFT', 'Rev NFT', 'RNT', BigInt(10 ** 15));
   this.revFactory = await deployProxy('RevFactory');
   this.saleNFT = await deployProxy('RevSale');
   console.log('RevSale address is ', this.saleNFT.address);
   this.auction = await deployProxy('RevAuction');
   console.log('RevAuction address is ', this.auction.address);
   this.marketPlace = await deployProxy('MarketPlace');
   console.log('marketplace address is ', this.marketPlace.address);
   this.marketPlaceRouter = await deployProxy('MarketPlaceRouter');
   console.log('marketplace router address is ', this.marketPlaceRouter.address);

   console.log('setting basic data...');

   await this.marketPlace.setOwner(this.marketPlaceRouter.address);

   await this.marketPlace.setData(
      this.auction.address,
      this.saleNFT.address,
      this.revNFT.address,
      WETH_address
   );

   await this.marketPlaceRouter.setBasicData(
      this.marketPlace.address,
      this.auction.address,
      this.saleNFT.address,
      this.revNFT.address,
      this.revFactory.address
   );
   
   await this.auction.setOwner(
      this.marketPlace.address,
      this.marketPlaceRouter.address
   );

   await this.saleNFT.setOwner(
      this.marketPlace.address,
      this.marketPlaceRouter.address
   );

   await this.revNFT.setMarketplaceAddress(this.marketPlaceRouter.address);

   for (let i = 0; i < moderates.length; i ++) {
      await this.marketPlaceRouter.addModerate(moderates[i]);
   }
   
   console.log("Deployed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });