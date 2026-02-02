const log = (msg) => {
    const el = document.getElementById('logs');
    const p = document.createElement('div');
    p.innerText = `> ${msg}`;
    el.appendChild(p);
    el.scrollTop = el.scrollHeight;
};

async function startDownload() {
    const input = document.getElementById('urlInput').value.trim();
    const btn = document.getElementById('downloadBtn');
    const statusArea = document.getElementById('statusArea');
    const progressBar = document.getElementById('progressBar');
    
    if (!input) {
        alert('Please paste a GitHub URL first!');
        return;
    }

    statusArea.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    progressBar.style.width = '0%';
    document.getElementById('logs').innerHTML = '';

    try {
        log('Resolving URL...');
        const details = parseGitHubUrl(input);
        if (!details) throw new Error('Invalid GitHub URL format');
        
        log(`Target: ${details.owner}/${details.repo}`);

        const apiUrl = `https://api.github.com/repos/${details.owner}/${details.repo}/git/trees/${details.branch}?recursive=1`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);

        const data = await response.json();
        
        const targetPath = details.path ? details.path.replace(/\/$/, '') : '';
        const filesToDownload = data.tree.filter(item => 
            item.type === 'blob' && (targetPath === '' || item.path.startsWith(targetPath))
        );

        if (filesToDownload.length === 0) throw new Error('No files found in this path.');
        log(`Preparing ${filesToDownload.length} files...`);

        const zip = new JSZip();
        let completed = 0;
        const batchSize = 5; 

        for (let i = 0; i < filesToDownload.length; i += batchSize) {
            const batch = filesToDownload.slice(i, i + batchSize);
            await Promise.all(batch.map(async (file) => {
                const rawUrl = `https://raw.githubusercontent.com/${details.owner}/${details.repo}/${details.branch}/${file.path}`;
                try {
                    const fileContent = await fetch(rawUrl).then(res => res.blob());
                    const zipPath = targetPath ? file.path.substring(targetPath.length + 1) : file.path;
                    if(zipPath) zip.file(zipPath, fileContent);
                } catch (e) {
                    log(`Failed to fetch: ${file.path}`);
                }
                
                completed++;
                progressBar.style.width = `${Math.round((completed / filesToDownload.length) * 100)}%`;
            }));
        }

        log('Compressing Archive...');
        const zipBlob = await zip.generateAsync({type:"blob"});
        const saveName = targetPath ? targetPath.split('/').pop() : details.repo;
        saveAs(zipBlob, `${saveName}.zip`);
        log('Success! Download started.');

    } catch (error) {
        log(`ERROR: ${error.message}`);
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.querySelector('span').innerText = 'Download Again';
    }
}

function parseGitHubUrl(url) {
    try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/').filter(p => p);
        if (parts.length < 2) return null;
        const owner = parts[0];
        const repo = parts[1];
        let branch = 'main';
        let path = '';
        const typeIndex = parts.findIndex(p => p === 'tree' || p === 'blob');
        if (typeIndex !== -1) {
            branch = parts[typeIndex + 1];
            path = parts.slice(typeIndex + 2).join('/');
        }
        return { owner, repo, branch, path };
    } catch (e) { 
        return null; 
    }
}
