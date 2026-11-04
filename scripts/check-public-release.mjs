/** Read-only check of files selected for publication. Never prints matched secrets. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(!files.length)throw Error('Stage the release files before running this check.');
const patterns=[
 ['personal filesystem path', /\/(?:Users|home)\/[a-zA-Z0-9_.-]+\//],
 ['Windows personal path', /[A-Za-z]:\\Users\\[^\\\s]+\\/],
 ['personal temporary path', /\/(?:private\/)?var\/folders\/[a-zA-Z0-9_/-]+/],
 ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
 ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
 ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
 ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
 ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/],
 ['API secret', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/],
 ['URL credential', /https?:\/\/[^\s/:"<>]{2,}:[^\s/@"<>]{4,}@/],
];
const failures=[];let textFiles=0;
for(const file of files){
 const data=readFileSync(file);if(data.subarray(0,8192).includes(0))continue;textFiles++;
 const source=data.toString('utf8');
 for(const [label,pattern]of patterns)if(pattern.test(source))failures.push(`${file}: ${label}`);
 if(/(?:^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.env.example'))failures.push(`${file}: environment file`);
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`Public release check passed: ${files.length} tracked files, ${textFiles} text files; no matched paths or credential formats.`);
