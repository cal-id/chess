"use strict";

/* This file deals with game logic:
 * - where can a piece move - ignoring check?
 * - where can a piece move - if can't put self in check?  TODO
 *
 * Note that castling is treated as a move for the king. */

const max = Math.max;
const min = Math.min;

/* Define the basic types of moves that each piece can make. These represent
 * the moves that each piece could take if the board was completely empty and
 * the piece could be anywhere. For example, a rook can move 7 squares in each
 * of the [up, left, right, down] directions.
 *
 *    The moves are a list of lists of vectors. Each inner list contains
 * all moves in a given direction. You can stop looking at the later
 * vectors in each inner list when one impossible one is reached and move
 * to the next inner list.
 *
 * eg: Rook contains four lists: up, left, down, right.
 *
 * Moves for the pawn are not given because it is colour specific and complex to describe in
 * this way. */

/* beautify ignore:start */
const movesByPiece = {};
movesByPiece[KING_B] = movesByPiece[KING_W] = [
  [[-1,  1]], [[0,  1]], [[1,  1]],
  [[-1,  0]],            [[1,  0]],
  [[-1, -1]], [[0, -1]], [[1, -1]]
];

movesByPiece[ROOK_B] = movesByPiece[ROOK_W] = [
  // [L, R, D, U] = [Left, Right, Down, Up]
  [[-1,  0], [-2,  0], [-3,  0], [-4,  0], [-5,  0], [-6,  0], [-7,  0]],  // L
  [[ 1,  0], [ 2,  0], [ 3,  0], [ 4,  0], [ 5,  0], [ 6,  0], [ 7,  0]],  // R
  [[ 0, -1], [ 0, -2], [ 0, -3], [ 0, -4], [ 0, -5], [ 0, -6], [ 0, -7]],  // D
  [[ 0,  1], [ 0,  2], [ 0,  3], [ 0,  4], [ 0,  5], [ 0,  6], [ 0,  7]]   // U
];

movesByPiece[BISHOP_B] = movesByPiece[BISHOP_W] = [
  // [L, R, B, T] = [Left, Right, Buttom, Top]
  [[-1, -1], [-2, -2], [-3, -3], [-4, -4], [-5, -5], [-6, -6], [-7, -7]],  // BL
  [[ 1, -1], [ 2, -2], [ 3, -3], [ 4, -4], [ 5, -5], [ 6, -6], [ 7, -7]],  // BR
  [[-1,  1], [-2,  2], [-3,  3], [-4,  4], [-5,  5], [-6,  6], [-7,  7]],  // TL
  [[ 1,  1], [ 2,  2], [ 3,  3], [ 4,  4], [ 5,  5], [ 6,  6], [ 7,  7]]   // TR
];

movesByPiece[KNIGHT_B] = movesByPiece[KNIGHT_W] = [
             [[-1,  2]], [[1,  2]],
  [[-2,  1]],                       [[2,   1]],
  [[-2, -1]],                       [[2,  -1]],
             [[-1, -2]], [[1, -2]]
];

/* beautify ignore:end */
movesByPiece[QUEEN_B] = movesByPiece[QUEEN_W] =
  Array.prototype.concat(movesByPiece[ROOK_B], movesByPiece[BISHOP_B]);

/* Returns a list of possible new indexes from a single move of a piece.
 * This is every move except castling.
 * Doesn't deal with any possible checks ... that should be done later,
 * it probably requires calling this function */
function whereCanPieceAdvance(state, index) {
  // Read core information from the state.
  const piece = state[index];
  const white = isWhiteToPlay(state);
  const [file, rank] = getFileRank(index);
  // Initiate the list of possible move indicies which will be returned.
  var movesToReturn = [];
  if (isPawn(piece)) {
    // All white pawn moves involve increasing the rank. All black pawn moves
    // involve decreasing the rank.
    const rankDirection = white ? 1 : -1;
    // If the square directly in front of the pawn is clear, the pawn can move
    // there.
    if (isEmpty(state[getIndex(file, rank + rankDirection)]))
      movesToReturn.push(getIndex(file, rank + rankDirection));
    // If this is the first move for this pawn, then the pawn can move forward
    // by two ranks rather than one).
    //    This can only happen if both the square immediately infront of it
    // *and* the square it is moving to is empty.
    //    A pawn can only be on its initial rank if it hasn't moved yet so
    // isPawn(initialState[index]) checks if it hasn't moved.
    if (isPawn(initialState[index]) &&
      isEmpty(state[getIndex(file, rank + rankDirection)]) &&
      isEmpty(state[getIndex(file, rank + 2 * rankDirection)]))
      movesToReturn.push(getIndex(file, rank + 2 * rankDirection));
    // Store the file and rank of the square which can be moved to for an
    // enPassant capture. If there isn't one, this is false.
    const enPassant = getEnPassant(state);
    // Add any potential captures, checking diagonal left then right.
    for (let fileOffset of [-1, 1]) {
      const newFile = file + fileOffset;
      const newRank = rank + rankDirection;
      if (!isInBoard(newFile, newRank)) break;
      const newIndex = getIndex(newFile, newRank);
      // Capture a piece, moving to newIndex if:
      //   1) there is a current piece at newIndex AND its not on our side or
      //   2) there is an en passant square in the state and we can move to it.
      if (!isEmpty(state[newIndex]) && !isIndexAPieceToMove(state, newIndex) ||
        (enPassant && enPassant[0] == newFile && enPassant[1] == newRank))
        movesToReturn.push(newIndex);
    }
  } else {
    // If it isn't a pawn then its moves are more regular and are defined
    // previously, grouped by direction.
    // For example: for a rook, this steps through [left, right, down, up]
    for (let movesInOneDirection of movesByPiece[piece]) {
      // Starting at the move closest to the piece in this direction, step
      // through the possible moves.
      for (let [df, dr] of movesInOneDirection) {
        const newFile = file + df;
        const newRank = rank + dr;
        // If the new position is outside the board then we have exhausted all
        // moves in this direction so move on to a new direction.
        if (!isInBoard(newFile, newRank)) break;
        const newIndex = getIndex(file + df, rank + dr);
        // Moving to an empty square is possible.
        if (isEmpty(state[newIndex]))
          movesToReturn.push(newIndex);
        else {
          // If it isn't empty then we can still move there provided it is
          // occupied by a opposing piece and this is a capture.
          if (!isIndexAPieceToMove(state, newIndex))
            movesToReturn.push(newIndex);
          // But this piece can't move further than this because the next moves
          // are 'blocked' by this one. Move to the next direction.
          break;
        }
      }
    }
  }
  return movesToReturn;
}

/* Can the current player take the opponent's king using whereCanPieceAdvance()
 * as moves. */
const canTakeTheirKing = state => canTakePieceAtIndex(state,
  state.indexOf(isWhiteToPlay(state) ? KING_B : KING_W));

/* Returns true or false if the current player can take the piece at index with
 * any of their pieces.
 * Go through all the pieces on the board, if any of them belong to the
 * current player and can take index, return true. Otherwise, return false. */
const canTakePieceAtIndex = (state, index) =>
  Array.prototype.some.call(state.substr(0, BOARD_SIZE),
    (aPiece, anIndex) => isIndexAPieceToMove(state, anIndex) &&
    whereCanPieceAdvance(state, anIndex).includes(index));

/* Returns true if the player about to move is in check.
 * Assumes that the current player does nothing by giving the state to the
 * opponent and then checks if they can take the current player's king */
const isStateInCheck = state => canTakeTheirKing(swapPlayer(state));

/* This function returns the valid moves for a piece. It uses
 * whereCanPieceAdvance() to check what moves are possible and then
 * filters them to moves that create a state where they can't take the
 * current player's king.
 * Finally it adds any moves (for the king) which involve castling.*/
function whereCanPieceMove(state, index) {
  // Start off with moves except castling and reduce them to those which,
  // don't put the current player in check.
  const movesToReturn = whereCanPieceAdvance(state, index)
    .filter((newIndex) =>
      !canTakeTheirKing(updateState(state, [index, newIndex])));
  if (isKing(state[index])) {
    // For each castle option this is a list of
    // [rook's index, is castling possible based on state,
    //  list of indicies that must be empty,
    //  list of indicies where they king cant be in check]
    // In the list of empties:
    //  - 2nd element is where the king moves
    // In the list of not in check use increasing order
    /* beautify ignore:start */
    const differentCastleOptions = [
      [56, canWCastleQ(state), [59, 58, 57], [58, 59, 60]],
      [63, canWCastleK(state), [61, 62], [60, 61, 62]],
      [0, canBCastleQ(state), [3, 2, 1], [2, 3, 4]],
      [7, canBCastleK(state), [5, 6], [4, 5, 6]]];
    /* beautify ignore:end */
    for (let [rookIndex, possible, mustBeEmpty, theyCantMoveTo] of
      differentCastleOptions) {
      // Do the basic checks, only continue if:
      // 1 + 2) we haven't moved this king / castle
      // 3) and every square between the king and the rook is empty
      if (possible && mustBeEmpty.every(anIndex => isEmpty(state[anIndex]))) {
        // At this point we must check if
        // 4) the king is not currently in check or
        // 5) the king does not pass through a square attacked by an enemy.
        // 6) the king does not end up in check

        // `theyCantMoveTo` contains a list of indicies that can't be moved to
        // by the opponent to pass 4, 5, 6 (not repectively).

        // Get a list of all the indicies that they can *capture* from this
        // state and check that none of the indicies in theyCantMoveTo are
        // included.

        // Although whereCanPieceAdvance() includes moves forward by pawns
        // which can't be captures, if a pawn can move forward and
        // interrupt the castling path then it also threatens a square on
        // the castling path.
        let theirState = swapPlayer(state);
        let theyCanCapture = [].concat.apply([],
          Array.prototype.map.call(state.substr(0, BOARD_SIZE),
            (aPiece, anIndex) => isIndexAPieceToMove(theirState, anIndex) ?
            whereCanPieceAdvance(theirState, anIndex) : []));
        if (theyCantMoveTo.every((indexToCheck) =>
            !theyCanCapture.includes(indexToCheck)))
          movesToReturn.push(mustBeEmpty[1]); // Add the castling move!
      }
    }
  }
  return movesToReturn;
}

/* Returns true if the piece at index in state is a piece that belongs to the
 * player that is about to play. If there is no piece at index, this return
 * false */
const isIndexAPieceToMove = (state, index) => !isEmpty(state[index]) &&
  !(isWhite(state[index]) ^ isWhiteToPlay(state));
