class TicTacToe {
  constructor(playerX, playerO) {
    this.playerX = playerX;
    this.playerO = playerO;
    this.board = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    this.turn = 'X';
    this.winner = null;
    this.gameOver = false;
  }
  
  makeMove(position, player) {
    if (this.gameOver) return { success: false, reason: 'already_over' };
    
    const mark = player === this.playerX ? 'X' : 'O';
    if (this.turn !== mark) return { success: false, reason: 'not_your_turn' };
    
    const pos = parseInt(position) - 1;
    if (pos < 0 || pos > 8) return { success: false, reason: 'invalid_position' };
    if (this.board[pos] === 'X' || this.board[pos] === 'O') return { success: false, reason: 'already_taken' };
    
    this.board[pos] = mark;
    
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    
    for (const pattern of winPatterns) {
      if (pattern.every(i => this.board[i] === mark)) {
        this.winner = player;
        this.gameOver = true;
        return { success: true, winner: player };
      }
    }
    
    if (!this.board.some(cell => cell !== 'X' && cell !== 'O')) {
      this.gameOver = true;
      return { success: true, draw: true };
    }
    
    this.turn = this.turn === 'X' ? 'O' : 'X';
    return { success: true };
  }
  
  getBoard() {
    return this.board.map((cell, i) => {
      if (cell === 'X') return '❌';
      if (cell === 'O') return '⭕';
      return `${i + 1}`;
    });
  }
  
  toString() {
    const b = this.getBoard();
    return `${b[0]} | ${b[1]} | ${b[2]}\n${b[3]} | ${b[4]} | ${b[5]}\n${b[6]} | ${b[7]} | ${b[8]}`;
  }
}

module.exports = TicTacToe;