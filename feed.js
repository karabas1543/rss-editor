const fs = require('fs');
const https = require('https');

// Function to fetch the original RSS feed
function fetchRSSFeed() {
  return new Promise((resolve, reject) => {
    https.get('https://feeds.buzzsprout.com/2285711.rss', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      console.error('Error fetching feed:', err);
      reject(err);
    });
  });
}

// Process the feed with simple string replacements
function processRSSFeed(xml) {
  try {
    // Step 1: Remove all XML declarations and stylesheets
    let processedXml = xml.replace(/<\?xml[^?]*\?>/g, '');
    processedXml = processedXml.replace(/<\?xml-stylesheet[^?]*\?>/g, '');
    
    // Step 2: Add our clean declarations
    const cleanHeader = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                       '<?xml-stylesheet href="https://feeds.buzzsprout.com/styles.xsl" type="text/xsl"?>\n';
    
    // Step 3: Process each item to ensure it has a link in the correct position
    // Find all items in the feed
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    let modifiedItems = [];
    
    while ((match = itemRegex.exec(processedXml)) !== null) {
      let itemContent = match[1];
      
      // Check if the item has an enclosure
      const enclosureMatch = /<enclosure url="([^"]+)"/.exec(itemContent);
      if (enclosureMatch) {
        const enclosureUrl = enclosureMatch[1];
        const plainUrl = enclosureUrl.replace(/\.mp3$/, '');
        
        // Remove any existing link tag
        itemContent = itemContent.replace(/<link>[^<]*<\/link>\s*/g, '');
        
        // Find the title tag to insert the link immediately after it
        const titleTagMatch = /<title>[^<]*<\/title>/g.exec(itemContent);
        if (titleTagMatch) {
          // Insert the link tag after the title tag
          const titleTag = titleTagMatch[0];
          const linkTag = `<link>${plainUrl}</link>`;
          itemContent = itemContent.replace(titleTag, `${titleTag}\n    ${linkTag}`);
        }
        
        // IMPORTANT FIX: Replace the GUID content with the actual URL
        // This is crucial for Mailchimp which uses guid for *|RSSITEM:URL|*
        itemContent = itemContent.replace(
          /<guid[^>]*>[^<]*<\/guid>/g, 
          `<guid isPermaLink="true">${plainUrl}</guid>`
        );
      }
      
      modifiedItems.push(itemContent);
    }
    
    // Replace all items in the feed
    let index = 0;
    processedXml = processedXml.replace(/<item>[\s\S]*?<\/item>/g, function() {
      return `<item>${modifiedItems[index++]}</item>`;
    });
    
    return cleanHeader + processedXml;
  } catch (error) {
    console.error('Error processing feed:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Fetching RSS feed...');
    const originalFeed = await fetchRSSFeed();
    
    console.log('Processing RSS feed...');
    const processedFeed = processRSSFeed(originalFeed);
    
    console.log('Writing processed feed to file...');
    fs.writeFileSync('feed.xml', processedFeed);
    
    console.log('Feed processing complete! Output written to feed.xml');
    
    // Preview the first 500 characters of the processed feed
    console.log('Preview of processed feed:');
    console.log(processedFeed.substring(0, 500) + '...');
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the script
main();