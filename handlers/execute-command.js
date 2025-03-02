import { spawn } from 'child_process';

export const executeCommandHandler = async (event, command) => {
    if (!command) {
        throw new Error('Command is required');
    }

    return new Promise((resolve, reject) => {
        const [cmd, ...args] = command.split(' ');
        const process = spawn(cmd, args);

        let output = '';
        let error = '';

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            error += data.toString();
        });

        process.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output || error,
                code
            });
        });

        process.on('error', (err) => {
            reject({
                success: false,
                error: err.message,
                code: 1
            });
        });
    });
}