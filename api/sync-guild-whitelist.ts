import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const BADGE_ADDRESS = '0xdceabcabbf9e70ffd8fa6b6fd76b22372e2045fa' as `0x${string}`;
const GUILD_ID = 'arctreasury';

const badgeAbi = [
  { name: 'addToWhitelist', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'users', type: 'address[]' }], outputs: [] },
  { name: 'whitelist', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const;

interface GuildMember {
  oderId?: number;
  odesses?: string[];
  addresses?: { address: string }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST or GET with secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: 'PRIVATE_KEY not configured' });
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    });

    // Check if we're the owner
    const owner = await publicClient.readContract({
      address: BADGE_ADDRESS,
      abi: badgeAbi,
      functionName: 'owner',
    } as const) as string;

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      return res.status(403).json({ error: 'Not contract owner' });
    }

    // Fetch Guild members
    console.log('Fetching Guild.xyz members...');

    const guildResponse = await fetch(
      `https://api.guild.xyz/v2/guilds/${GUILD_ID}/members`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!guildResponse.ok) {
      const errorText = await guildResponse.text();
      console.error('Guild API error:', errorText);
      return res.status(502).json({ error: 'Failed to fetch Guild members', details: errorText });
    }

    const members = await guildResponse.json();

    // Extract addresses from members
    const guildAddresses: string[] = [];

    if (Array.isArray(members)) {
      for (const member of members) {
        // Guild API returns addresses in different formats
        if (member.addresses && Array.isArray(member.addresses)) {
          for (const addr of member.addresses) {
            if (typeof addr === 'string') {
              guildAddresses.push(addr.toLowerCase());
            } else if (addr.address) {
              guildAddresses.push(addr.address.toLowerCase());
            }
          }
        }
      }
    }

    console.log(`Found ${guildAddresses.length} addresses in Guild`);

    // Check which addresses are not yet whitelisted
    const newAddresses: `0x${string}`[] = [];

    for (const addr of guildAddresses) {
      if (!addr.startsWith('0x') || addr.length !== 42) continue;

      try {
        const isWhitelisted = await publicClient.readContract({
          address: BADGE_ADDRESS,
          abi: badgeAbi,
          functionName: 'whitelist',
          args: [addr as `0x${string}`],
        } as const) as boolean;

        if (!isWhitelisted) {
          newAddresses.push(addr as `0x${string}`);
        }
      } catch (e) {
        console.error(`Error checking ${addr}:`, e);
      }
    }

    console.log(`${newAddresses.length} new addresses to whitelist`);

    if (newAddresses.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new addresses to whitelist',
        guildMembers: guildAddresses.length,
        newAddresses: 0,
      });
    }

    // Add to whitelist in batches of 50
    const batchSize = 50;
    const results: string[] = [];

    for (let i = 0; i < newAddresses.length; i += batchSize) {
      const batch = newAddresses.slice(i, i + batchSize);

      console.log(`Adding batch ${Math.floor(i / batchSize) + 1}: ${batch.length} addresses`);

      const hash = await walletClient.writeContract({
        address: BADGE_ADDRESS,
        abi: badgeAbi,
        functionName: 'addToWhitelist',
        args: [batch],
        chain: arcTestnet,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      results.push(hash);

      console.log(`Batch ${Math.floor(i / batchSize) + 1} confirmed: ${hash}`);
    }

    return res.status(200).json({
      success: true,
      guildMembers: guildAddresses.length,
      newAddresses: newAddresses.length,
      transactions: results,
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      message: error.message,
    });
  }
}
