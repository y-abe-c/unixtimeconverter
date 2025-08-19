import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {


	// 設定の取得
	const config = vscode.workspace.getConfiguration('UnixTimeConveter');
	const int_threshold = config.get<number>('threshold', 1e9);


	/**
	 * Hover Provider: マウスオーバーでUnix時刻を日時に変換して表示
	 */
	const hoverProvider = vscode.languages.registerHoverProvider('*', {
		provideHover(document, position) {
			const range = document.getWordRangeAtPosition(position, /\d+(\.\d+)?/);
			if (!range) return;

			const text = document.getText(range);
			if (!/^\d+(\.\d+)?$/.test(text)) return;

			const [intPartStr, fracPart] = text.split('.');
			const intPart = Number(intPartStr);
			if (!Number.isFinite(intPart) || intPart < int_threshold) return;

			// 秒単位 or ミリ秒単位の判定
			const date = new Date(intPart < 1e12 ? intPart * 1000 : intPart);

			const jst = formatDateWithFraction(date, fracPart);
			const utc = formatDateWithFraction(new Date(date.getTime() - date.getTimezoneOffset() * 60000), fracPart, true);

			return new vscode.Hover(`🕒 **JST:** ${jst}`);
		}
	});
	context.subscriptions.push(hoverProvider);

	/**
	 * コマンド: 文書全体のUnix時刻を日時に一括変換
	 */
	const convertAllDisposable = vscode.commands.registerCommand('extension.convertAllUnixTimes', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = editor.document;
		const text = document.getText();
		const unixRegex = /\b\d+(\.\d+)?\b/g;
		const edits: vscode.TextEdit[] = [];
		let match: RegExpExecArray | null;

		while ((match = unixRegex.exec(text)) !== null) {
			const [intPartStr, fracPart] = match[0].split('.');
			const intPart = Number(intPartStr);
			if (!Number.isFinite(intPart) || intPart < int_threshold) continue;

			const date = new Date(intPart < 1e12 ? intPart * 1000 : intPart);
			const jst = formatDateWithFraction(date, fracPart);

			const start = document.positionAt(match.index);
			const end = document.positionAt(match.index + match[0].length);
			edits.push(vscode.TextEdit.replace(new vscode.Range(start, end), jst));
		}

		if (edits.length === 0) {
			vscode.window.showWarningMessage('変換対象のUnix時刻が見つかりませんでした。');
			return;
		}

		editor.edit(editBuilder => {
			for (const edit of edits) {
				editBuilder.replace(edit.range, edit.newText);
			}
		});
		vscode.window.showInformationMessage(`Unix時刻を ${edits.length}件 日時に変換しました`);

	});
	context.subscriptions.push(convertAllDisposable);



	const convertSelectionDisposable = vscode.commands.registerCommand('extension.convertSelectionUnixTimes', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = editor.document;
		const selections = editor.selections;

		const unixRegex = /\b\d+(\.\d+)?\b/g;
		const edits: vscode.TextEdit[] = [];

		for (const selection of selections) {
			const selectedText = document.getText(selection);
			let offset = document.offsetAt(selection.start);
			let match: RegExpExecArray | null;

			while ((match = unixRegex.exec(selectedText)) !== null) {
				const [intPartStr, fracPart] = match[0].split('.');
				const intPart = Number(intPartStr);
				if (!Number.isFinite(intPart) || intPart < int_threshold) continue;

				const date = new Date(intPart < 1e12 ? intPart * 1000 : intPart);
				const jst = formatDateWithFraction(date, fracPart);

				const start = document.positionAt(offset + match.index);
				const end = document.positionAt(offset + match.index + match[0].length);
				edits.push(vscode.TextEdit.replace(new vscode.Range(start, end), jst));
			}
		}

		if (edits.length === 0) {
			vscode.window.showWarningMessage('選択範囲に変換対象のUnix時刻が見つかりませんでした。');
			return;
		}

		editor.edit(editBuilder => {
			for (const edit of edits) {
				editBuilder.replace(edit.range, edit.newText);
			}
		});
		vscode.window.showInformationMessage(`Unix時刻を ${edits.length}件 日時に変換しました`);

	});
	context.subscriptions.push(convertSelectionDisposable);

}

/**
 * 日時を "YYYY/MM/DD HH:mm:ss[.小数部分]" 形式で返す
 */
function formatDateWithFraction(date: Date, fraction?: string, utc: boolean = false): string {
	const y = utc ? date.getUTCFullYear() : date.getFullYear();
	const m = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
	const d = utc ? date.getUTCDate() : date.getDate();
	const hh = utc ? date.getUTCHours() : date.getHours();
	const mm = utc ? date.getUTCMinutes() : date.getMinutes();
	const ss = utc ? date.getUTCSeconds() : date.getSeconds();

	const pad = (n: number) => n.toString().padStart(2, '0');

	let result = `${y}/${pad(m)}/${pad(d)} ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
	if (fraction) {
		result += `.${fraction}`;
	}
	return result;
}

export function deactivate() { }
