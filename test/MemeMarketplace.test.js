const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, deployProxy, getAt } = require('../scripts/utils');
const { signMakeOrder } = require("./utils/meta_transaction");

const bigNum = num=>(num + '0'.repeat(18))
const smallNum = num=>(parseInt(num)/bigNum(1))
const zeroAddress = '0x0000000000000000000000000000000000000000';

const tokenURI = 'https://gateway.pinata.cloud/ipfs/QmfUk1XLTrgQmbjwGw7sKa1DggNeZoYtk5JD4n4bq1eRHk';

describe('MemeMarketplace', function () {
   before (async function () {
      [
         this.deployer,
         this.minter1,
         this.minter2,
         this.bider1,
         this.bider2,
         this.multisig
      ] = await ethers.getSigners();

      this.strategyManager = await deployProxy('MemeStrategyManager');
      this.ERC721Manager = await deploy('TransferManagerERC721');
      this.ERC1155Manager = await deploy('TransferManagerERC1155');
      this.WETH = await deploy('WETH');
      this.Meme721 = await deploy('Meme721', 'Meme 721', 'MEME721');
      this.Meme1155 = await deploy('Meme1155');

      this.marketplace = await deploy(
         'MemeMarketplace',
         this.strategyManager.address,
         this.ERC721Manager.address,
         this.ERC1155Manager.address,
         this.Meme721.address,
         this.Meme1155.address,
         this.WETH.address,
         this.multisig.address
      );

      await this.Meme721.setMarketplaceAddress(this.marketplace.address);
      await this.Meme1155.setMarketplaceAddress(this.marketplace.address);
      await this.ERC721Manager.setMarketPlace(this.marketplace.address);
      await this.ERC1155Manager.setMarketPlace(this.marketplace.address);
      await this.strategyManager.addOwner(this.marketplace.address);
   })

   it ('check initial state', async function () {
      expect(smallNum(await this.WETH.balanceOf(this.deployer.address))).to.equal(10**6);
   })

   it ('mint Meme721 and add collection to marketplace', async function () {
      await this.marketplace.connect(this.minter1).mintMeme721(
         [tokenURI],
         {value: BigInt(10 ** 15)}
      );
   })

   it ('buy Meme721', async function () {

      const makeOrder = {
         maker: this.minter1.address,
         tokenAddress: this.Meme721.address,
         tokenID: 0,
         price: bigNum(1),
         tokenAmount: 1,
         isETH: true
      };

      const signedMakeOrder = await signMakeOrder(
         this.minter1,
         this.marketplace.address,
         makeOrder
      );

      let oldETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let oldNFTValue = await this.Meme721.balanceOf(this.bider1.address);

      await this.Meme721.connect(this.minter1).setApprovalForAll(this.ERC721Manager.address, true);
      await this.marketplace.connect(this.bider1).buyNonFindgibleToken(
         signedMakeOrder,
         {value: bigNum(1)}
      );

      let newETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let newNFTValue = await this.Meme721.balanceOf(this.bider1.address);

      expect(newNFTValue - oldNFTValue).to.equal(1);
      expect(newETHValue - oldETHValue).to.greaterThan(0.97);

   })

   it ('mint Meme1155 and add collection to marketplace', async function () {
      await this.marketplace.connect(this.minter1).mintMeme1155(tokenURI, 20, {value: BigInt(10 ** 15 * 20)});
      expect(
         await this.Meme1155.balanceOf(this.minter1.address, 0)
      ).to.equal(20);

      expect(
         await this.Meme1155.totalSupply(0)
      ).to.equal(20);

      expect(
         await this.Meme1155.exists(0)
      ).to.equal(true);

      expect(
         await this.Meme1155.exists(1)
      ).equal(false);
   })

   it ('buy Meme1155', async function () {
      const makeOrder = {
         maker: this.minter1.address,
         tokenAddress: this.Meme1155.address,
         tokenID: 0,
         price: bigNum(5),
         tokenAmount: 5,
         isETH: true
      };

      const signedMakeOrder = await signMakeOrder(
         this.minter1,
         this.marketplace.address,
         makeOrder
      );

      let oldETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let oldNFTValue = await this.Meme1155.balanceOf(this.bider1.address, 0);

      await this.Meme1155.connect(this.minter1).setApprovalForAll(this.ERC1155Manager.address, true);
      await this.marketplace.connect(this.bider1).buyNonFindgibleToken(
         signedMakeOrder,
         {value: bigNum(5)}
      );

      let newETHValue = smallNum(await ethers.provider.getBalance(this.minter1.address));
      let newNFTValue = await this.Meme1155.balanceOf(this.bider1.address, 0);

      expect(newNFTValue - oldNFTValue).to.equal(5);
      expect(newETHValue - oldETHValue).to.greaterThan(4.8);
   })

})