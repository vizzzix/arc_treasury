// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PointsMultiplierNFT
 * @notice NFT that doubles points for TreasuryVault users
 * @dev ERC721 token with fixed supply of 2000 (rare)
 */
contract PointsMultiplierNFT is ERC721, Ownable, ReentrancyGuard {
    /// @notice Maximum supply of NFTs
    uint256 public constant MAX_SUPPLY = 2000;
    
    /// @notice Current token ID counter
    uint256 private _tokenIdCounter;
    
    /// @notice Base URI for token metadata
    string private _baseTokenURI;
    
    /// @notice Minting price (0 for free mint on testnet)
    uint256 public mintPrice = 0;
    
    /// @notice Whether minting is enabled
    bool public mintingEnabled = true;
    
    /// @notice Mapping to track if address has already minted (one per address)
    mapping(address => bool) public hasMinted;
    
    /// @notice Events
    event Mint(address indexed to, uint256 indexed tokenId);
    event MintingEnabled(bool enabled);
    event MintPriceUpdated(uint256 newPrice);
    
    constructor(
        address initialOwner,
        string memory baseURI
    ) ERC721("ARC Treasury Points Multiplier", "ATPM") Ownable(initialOwner) {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @notice Mints one NFT to the caller
     * @dev One NFT per address, free mint on testnet
     */
    function mint() external nonReentrant {
        require(mintingEnabled, "Minting disabled");
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(!hasMinted[msg.sender], "Already minted");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        hasMinted[msg.sender] = true;
        _safeMint(msg.sender, tokenId);
        
        emit Mint(msg.sender, tokenId);
    }
    
    /**
     * @notice Gets the current supply (number of minted tokens)
     * @return Current supply
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @notice Checks if an address owns at least one NFT
     * @param owner Address to check
     * @return true if address owns at least one NFT
     */
    function hasNFT(address owner) external view returns (bool) {
        return balanceOf(owner) > 0;
    }
    
    /**
     * @notice Sets the base URI for token metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @notice Enables or disables minting
     * @param enabled Whether minting should be enabled
     */
    function setMintingEnabled(bool enabled) external onlyOwner {
        mintingEnabled = enabled;
        emit MintingEnabled(enabled);
    }
    
    /**
     * @notice Sets the minting price (for future use)
     * @param newPrice New minting price
     */
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }
    
    /**
     * @notice Returns the base URI for token metadata
     * @return Base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @notice Returns the token URI for a given token ID
     * @param tokenId Token ID
     * @return Token URI string
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_baseURI(), _toString(tokenId), ".json"));
    }
    
    /**
     * @notice Converts a uint256 to its ASCII string decimal representation
     * @param value The number to convert
     * @return String representation
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

