const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const runCommand = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd,
    stdio: 'pipe'
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve({ stdout, stderr });
      return;
    }

    reject(new Error(stderr || stdout || `${command} ${args.join(' ')} failed with code ${code}`));
  });
});

/**
 * Deploys a React build to Vercel using their API
 * @param {string} buildDir - Path to the build directory
 * @param {string} storeName - Name of the store
 * @param {string} domain - Custom domain for the store
 * @returns {Promise<Object>} - Deployment result with URL
 */
async function deployToVercel(buildDir, storeName, domain, preferredProjectName, preferredAlias) {
  try {
    console.log(`🚀 Starting Vercel deployment for ${storeName}...`);
    
    // Check if Vercel token exists
    if (!process.env.VERCEL_TOKEN) {
      throw new Error('VERCEL_TOKEN environment variable is required');
    }
    
    // Build the Vite React project first
    console.log('📦 Building Vite project...');
    try {
      await runCommand('npm', ['install'], buildDir);
      await runCommand('npm', ['run', 'build'], buildDir);
    } catch (buildError) {
      console.error('Build failed:', buildError.message);
      throw new Error('Failed to build Vite project: ' + buildError.message);
    }
    
    // Get all build files from dist/ folder
    const distPath = path.join(buildDir, 'dist');
    if (!fs.existsSync(distPath)) {
      throw new Error('Dist directory not found. Make sure npm run build completed successfully.');
    }
    
    const files = await getAllFiles(distPath);
    console.log(`📁 Found ${files.length} files in dist folder`);
    
    // List all files found in dist
    files.forEach(filePath => {
      const relativePath = path.relative(distPath, filePath);
      const size = fs.statSync(filePath).size;
      console.log(`  📄 ${relativePath} (${size} bytes)`);
    });
    
    // Prepare files for Vercel API - only include static build output files
    const vercelFiles = files
      .filter(filePath => {
        const relativePath = path.relative(distPath, filePath);
        
        // Exclude any build configuration files that might have been copied to dist
        const excludePatterns = [
          'package.json',
          'package-lock.json', 
          'vite.config.js',
          'node_modules/',
          '.git/',
          'src/',
          'public/'
        ];
        
        return !excludePatterns.some(pattern => 
          relativePath.includes(pattern) || relativePath.startsWith(pattern)
        );
      })
      .map(filePath => {
        const relativePath = path.relative(distPath, filePath);
        const fileContent = fs.readFileSync(filePath);
        
        // Always send base64 with explicit encoding
        return {
          file: relativePath,
          data: fileContent.toString('base64'),
          encoding: 'base64'
        };
      });
    
    console.log(`📦 Filtered to ${vercelFiles.length} files for deployment (excluding build config):`);
    vercelFiles.forEach(f => {
      const absolute = path.join(distPath, f.file);
      let size = 0;
      try { size = fs.statSync(absolute).size; } catch {}
      console.log(`  ✅ ${f.file} (${size} bytes)`);
    });
    
    // Deploy pure static files - the first deployment worked, the issue was content display
    // Let's investigate the base64 issue differently
    console.log('🚀 Deploying pure static files (no config files)');
    console.log('📦 Files to deploy:', vercelFiles.length);
    console.log('');
  
    // Choose a stable project name so subsequent publishes go to the same URL
    // Prefer the store domain (unique) and fall back to storeName
    const preferred = (domain || storeName || 'store');

    // Sanitize name for Vercel requirements
    // Project names must be lowercase, can include letters, digits, '.', '_', '-'
    const finalName = preferred
    // Derive a stable project base name from domain (preferred) or storeName
    const rawBase = (domain && !domain.includes('.')) ? domain : (storeName || 'store');
    const baseName = (rawBase || 'store')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/---+/g, '--')
      .substring(0, 100) || 'store';

    console.log(`📝 Using stable Vercel project name: "${finalName}"`);

    // If custom domain is attached to another project, deploy to that project instead
    let projectName = (preferredProjectName && preferredProjectName.trim())
      ? preferredProjectName.trim()
      : `${baseName}-static`.substring(0, 100);

    if (domain && domain.includes('.')) {
      const ownerProject = await getProjectNameForDomain(domain);
      if (ownerProject) {
        projectName = ownerProject;
        console.log(`📝 Using existing project that owns domain: "${projectName}"`);
      }
    }

    console.log(`📝 Using stable Vercel project name: "${projectName}"`);
    // Create deployment payload
    const deploymentPayload = {
      name: projectName,
      files: vercelFiles,
      target: 'production'
    };
    
    // Ensure the project exists (no-op if it already does)
    await ensureProjectExists(projectName);

    // Deploy to Vercel with skipAutoDetectionConfirmation to bypass framework detection
    console.log('☁️ Deploying to Vercel with auto-detection bypass...');
    const response = await axios.post(
      'https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1',
      deploymentPayload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes timeout
      }
    );
    
    const deployment = response.data;
    console.log(`✅ Deployment created with ID: ${deployment.id}`);
    
    // Wait for deployment to be ready
    const deploymentUrl = await waitForDeployment(deployment.id, finalName);
    
    console.log(`🌐 Site deployed successfully: https://${deploymentUrl}`);

    // Determine primary stable alias
    const stableSubdomain = `${baseName}.vercel.app`;
    let desiredAlias = preferredAlias && preferredAlias.trim() ? preferredAlias.trim() : '';

    // If no preferred alias yet, choose custom domain (if present) otherwise stable subdomain
    if (!desiredAlias) {
      if (domain && domain.trim()) {
        desiredAlias = domain.includes('.') ? domain.trim().toLowerCase() : `${domain.trim().toLowerCase()}.vercel.app`;
      } else {
        desiredAlias = stableSubdomain;
      }
    }

    let finalUrl = `https://${deploymentUrl}`;

    // Always try to set the stable subdomain first to guarantee a stable URL
    try {
      const subAssigned = await assignAliasToDeployment(deployment.id, stableSubdomain);
      if (subAssigned) {
        finalUrl = `https://${stableSubdomain}`;
        console.log(`🔗 Assigned stable subdomain alias: ${finalUrl}`);
      } else {
        console.warn('⚠️ Failed to assign stable subdomain alias');
      }
    } catch (e) {
      console.warn('⚠️ Stable subdomain alias error:', e.response?.data || e.message);
    }

    // Then, if desired alias differs (e.g., custom domain), attempt it as well
    if (desiredAlias !== stableSubdomain) {
      try {
        const isCustom = desiredAlias.includes('.') && !desiredAlias.endsWith('.vercel.app');
        if (isCustom) {
          await safeAddDomainToProject(projectName, desiredAlias);
        }
        const aliasAssigned = await assignAliasToDeployment(deployment.id, desiredAlias);
        if (aliasAssigned) {
          finalUrl = `https://${desiredAlias}`;
          console.log(`🔗 Assigned custom alias to deployment: ${finalUrl}`);
        } else {
          console.warn('⚠️ Custom alias assignment failed; keeping current URL');
        }
      } catch (aliasErr) {
        console.warn('⚠️ Custom alias assignment error:', aliasErr.response?.data || aliasErr.message);
      }
    }
    
    return {
      success: true,
      url: finalUrl,
      deploymentId: deployment.id,
      deploymentUrl,
      projectName,
      alias: finalUrl.replace(/^https?:\/\//, '')
    };
    
  } catch (error) {
    console.error('❌ Vercel deployment failed:', error.message);
    
    if (error.response) {
      console.error('Vercel API Error:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
}

/**
 * Recursively gets all files in a directory
 * @param {string} dirPath - Directory path
 * @param {string[]} files - Array to collect file paths
 * @returns {string[]} - Array of file paths
 */
async function getAllFiles(dirPath, files = []) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      await getAllFiles(itemPath, files);
    } else {
      files.push(itemPath);
    }
  }
  
  return files;
}

/**
 * Waits for a Vercel deployment to be ready
 * @param {string} deploymentId - Vercel deployment ID
 * @returns {Promise<string>} - Deployment URL
 */
async function waitForDeployment(deploymentId, stableName, maxAttempts = 30) {
  console.log('⏳ Waiting for deployment to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(
        `https://api.vercel.com/v13/deployments/${deploymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
          }
        }
      );
      
      const deployment = response.data;
      
      // Debug: Log the full response to understand the structure
      if (attempt === 1) {
        console.log('🔍 Deployment response structure:', {
          state: deployment.state,
          readyState: deployment.readyState,
          status: deployment.status,
          url: deployment.url,
          alias: deployment.alias
        });
      }
      
      // Check multiple possible state fields
      const state = deployment.state || deployment.readyState || deployment.status;
      
      if (state === 'READY' || state === 'ready') {
        // Prefer the stable alias when available, then fall back to project domain
        const finalUrl = deployment.alias?.[0] || `${stableName}.vercel.app` || deployment.url || `${deploymentId}.vercel.app`;
        console.log(`🎉 Deployment ready! URL: ${finalUrl}`);
        return finalUrl;
      } else if (state === 'ERROR' || state === 'error' || state === 'FAILED') {
        // Try to get more details about the error
        console.log('🔍 Full deployment object for error analysis:', JSON.stringify(deployment, null, 2));
        
        let errorDetails = 'Unknown build error';
        
        // Check for build errors
        if (deployment.builds && deployment.builds.length > 0) {
          console.log('🔍 Build information:', JSON.stringify(deployment.builds, null, 2));
          const failedBuild = deployment.builds.find(b => b.error);
          if (failedBuild) {
            errorDetails = failedBuild.error.message || failedBuild.error;
            console.log('❌ Build error details:', failedBuild.error);
          }
        }
        
        // Check for general error fields
        if (deployment.error) {
          console.log('❌ General error:', deployment.error);
          errorDetails = deployment.error.message || deployment.error;
        }
        
        throw new Error(`Deployment failed on Vercel: ${errorDetails}`);
      }
      
      console.log(`⏳ Deployment status: ${state || 'unknown'} (attempt ${attempt}/${maxAttempts})`);
      
      // For the first few attempts, wait less time
      const waitTime = attempt <= 5 ? 5000 : 10000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
    } catch (error) {
      console.log(`⚠️ Deployment check attempt ${attempt} failed:`, error.message);
      
      // If we're getting 404s, the deployment might not be queryable yet
      if (error.response?.status === 404 && attempt < 10) {
        console.log('   Deployment not found yet, waiting for it to become queryable...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      if (attempt === maxAttempts) {
        throw new Error(`Deployment check failed after ${maxAttempts} attempts: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  throw new Error('Deployment timed out - took longer than expected');
}

/**
 * Gets deployment status from Vercel
 * @param {string} deploymentId - Vercel deployment ID
 * @returns {Promise<Object>} - Deployment status
 */
async function getDeploymentStatus(deploymentId) {
  try {
    const response = await axios.get(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get deployment status: ${error.message}`);
  }
}

/**
 * Deletes a deployment from Vercel
 * @param {string} deploymentId - Vercel deployment ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteDeployment(deploymentId) {
  try {
    await axios.delete(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Failed to delete deployment:', error.message);
    return false;
  }
}

async function assignAliasToDeployment(deploymentId, alias) {
  try {
    const res = await axios.post(
      `https://api.vercel.com/v2/deployments/${deploymentId}/aliases`,
      { alias },
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return res.status === 200 || res.status === 201;
  } catch (error) {
    console.warn('Alias API error:', error.response?.data || error.message);
    return false;
  }
}

async function safeAddDomainToProject(projectName, domain) {
  try {
    await axios.post(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/domains`,
      { name: domain },
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    const code = error.response?.data?.error?.code || error.response?.data?.code;
    if (code !== 'domain_already_exists' && code !== 'forbidden' && code !== 'domain_conflict') {
      console.warn('add domain warning:', error.response?.data || error.message);
    }
  }
}

async function ensureProjectExists(projectName) {
  try {
    await axios.get(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}`,
      { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` } }
    );
    return true;
  } catch (err) {
    if (err.response?.status === 404) {
      await axios.post(
        'https://api.vercel.com/v10/projects',
        { name: projectName },
        { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' } }
      );
      return true;
    }
    console.warn('ensureProjectExists warning:', err.response?.data || err.message);
    return false;
  }
}

async function getProjectNameForDomain(domain) {
  try {
    const res = await axios.get(
      `https://api.vercel.com/v6/domains/${encodeURIComponent(domain.trim().toLowerCase())}`,
      { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` } }
    );
    const projectId = res.data?.projectId || res.data?.domain?.projectId;
    if (!projectId) return null;
    const proj = await axios.get(
      `https://api.vercel.com/v10/projects/${projectId}`,
      { headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN}` } }
    );
    return proj.data?.name || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  deployToVercel,
  waitForDeployment,
  getDeploymentStatus,
  deleteDeployment
};
