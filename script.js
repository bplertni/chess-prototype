const DEBUG_FLAG = false;
const XFEN_START = [ 'br1', 'bn1', 'bb1', 'bq1', 'bk1', 'bb2', 'bn2', 'br2' ,     
                     'bp1', 'bp2', 'bp3', 'bp4', 'bp5', 'bp6', 'bp7', 'bp8' ,
                     '.',   '.',   '.',   '.',   '.',   '.',   '.',   '.' ,  
                     '.',   '.',   '.',   '.',   '.',   '.',   '.',   '.' ,  
                     '.',   '.',   '.',   '.',   '.',   '.',   '.',   '.' ,  
                     '.',   '.',   '.',   '.',   '.',   '.',   '.',   '.' ,  
                     'wp1', 'wp2', 'wp3', 'wp4', 'wp5', 'wp6', 'wp7', 'wp8' ,
                     'wr1', 'wn1', 'wb1', 'wq1', 'wk1', 'wb2', 'wn2', 'wr2'
                   ];
const squareXlat = [
    'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',  //  R
    'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',  //
    'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',  //  A
    'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',  //
    'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',  //  N
    'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',  // 
    'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',  //  K
    'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'   // 
   ];              

// ====================================================================================================================
// Helper Functions

function validatePGN() {
  var inputPGN = document.getElementById("pgnTextArea").value;
  //PGN Validation logic
  const chessObj = new Chess();
  var isValidPGN = chessObj.load_pgn(inputPGN);
  if (isValidPGN) {
    return inputPGN;
  } else {
    return null;
  }
}

function display_xfen_debug(xfen) {
  // display xfen information in a consistant manner for debugging only
  let xpand = "";
  for (ix = 0; ix < xfen.length; ix++) {
    if (xfen[ix] == ".") {
      xpand = xpand + "...";
    } else {
      xpand = xpand + xfen[ix];
    }
    if ([7, 15, 23, 31, 39, 47, 55].includes(ix)) {
      xpand = xpand + "/";
    }
  }
  return xpand;
}

function squareCode2Idx(squareCode) {
  // accept A1..H8 and return the appropriate index value 0..63
  let lowercode = squareCode.toLowerCase();
  let localIx = squareXlat.indexOf(lowercode);
  return localIx;
}

function numberNewPiece(iPawn3) {
  // take a pawn 1..8 and return a code for its promoted counterpart 3,4,5,6,7,8,9,0
  let lnum = parseInt(iPawn3);
  lnum = lnum + 2;
  if (lnum > 9) {
    lnum = 0;
  }
  lnum = lnum.toString();
  return lnum;
}

// expands FEN information, example:   /4p3/ becomes ['.','.','.','.','p','.','.','.']
// and this process is done for all 8 RANKS and ignores the remaining portion of the FEN
function fen2array(ifen) {
  // get just piece placement portion
  let PIECES = "pnbrqkPNBRQK";
  var a2 = Array();
  var a1 = ifen.split(" ")[0].split("/"); //get 1st part of fen string which is the piece/board positions
  for (let i = 0; i <= 7; i++) {
    // for each RANK
    for (let k = 0; k < a1[i].length; k++) {
      // for each character in a RANK's fen part
      if (PIECES.includes(a1[i].charAt(k))) {
        a2.push(a1[i].charAt(k)); // keeps the PIECE char
      } else if ("12345678".includes(a1[i].charAt(k))) {
        var c = a1[i].charAt(k);
        var n = parseInt(c);
        for (let m = 1; m <= n; m++) {
          a2.push(".");
        } // expands 1..8 to that count of spaces
      }
    }
  }
  return a2;
}

// ====================================================================================================================
//   A chess game instance
//   When created this object digests a PGN and populates a series of arrays that
//   are indexed by the game turn/ply
function ChessGame(ipgn) {
  if (ipgn == null) {
    alert("Invalid Format");
    return null;
  }

  this.pgn = ipgn; // expect a validated pgn but should validate anyway
  this.pgnArray = [];
  this.fens = []; // holding the fens from the digested pgn
  this.efens = []; // expanded fens as an array with full spaces as '.'
  this.xfens = []; // expanded fens as array with colors and piece numbers 'wp4'
  this.moves = [""]; // pgn part for each position
  this.moved = []; // true/false for a given square to indicate if it's piece has moved
  this.captured = []; // array, indexed by turn/ply indicating what was captured, if anything
  this.history = []; // verbose history returned by chess.js.history

  // workers used in the construction of the ChessGame object
  // chess1 holds the digested pgn and chess2 is used to walk the moves and extract the fens

  let chess1 = new Chess();
  let chess2 = new Chess();
  let startPos = chess2.fen();
  let posIdx = 0;
  let fen = ""; // fen string
  let efen = ""; // fen string with blanks
  let xfen_prev = ""; // xfen string as efen but including colors and numbers, _p = prior
  let xfen_curr = ""; // fen string as efen but including colors and numbers, _c = current
  let promoted = "";

  let ascii = "";

  // =====  initialize the worker objects  =====
  chess1.load_pgn(ipgn);
  this.pgnArray = chess1
    .pgn()
    .split(/\d+\./)
    .filter(Boolean)
    .map((move) => move.trim())
    .join(" ")
    .split(" ");
  chess2.load_pgn("");

  // the JSON syntax here is for doing a DEEP copy of an array of strings
  // might be overkill but works for now
  xfen_prev = JSON.parse(JSON.stringify(XFEN_START));
  this.xfens.push(xfen_prev); //push the starting efens array into the efens array

  // need to ensure that all of arrays in this object have the same starting index of 0 or 1
  // in order to align their data
  // =====#####=====  debugging info, show starting pos  =====#####=====
  if (DEBUG_FLAG) {
    console.log(posIdx, chess2.fen());
    console.log(chess2.ascii());
  }

  // setup the moved array, each move/turn this array is copied forward
  // and updated with the current move(s)
  let arr = Array(64).fill(false);
  this.moved.push(arr);

  //let ltest = chess1.history( {verbose: true} ) ;
  //if (DEBUG_FLAG) { console.log(  ltest ); }

  // ====================================================================================
  // #####     the first pass over history just to get all FEN information
  // #####     which is pushed into the efens array
  // ====================================================================================
  this.fens = chess1.history().map((move) => {
    chess2.move(move);
    fen = chess2.fen;
    efen = fen2array(chess2.fen());
    this.efens.push(efen);
    return chess2.fen();
  });
  if (DEBUG_FLAG) {
    console.log(this.fens);
    debugger;
  }
  let local_ix = 0; //this aligns with the TURN/PLY but starts at 0
  // ====================================================================================
  // =====  walk the game history again to get to:, fr:, and san: detail
  // =====  and also to expand the fens to xfens which includes colors and numbers
  // ====================================================================================
  this.history = chess1.history({ verbose: true }).map((map_obj) => {
    if (DEBUG_FLAG) {
      console.log("turn : ", local_ix + 1);
    }
    if (DEBUG_FLAG) {
      console.log(
        map_obj.color,
        map_obj.piece,
        map_obj.from,
        map_obj.to,
        map_obj.san
      );
    }
    this.moves.push({
      san: map_obj.san,
      color: map_obj.color,
      piece: map_obj.piece,
      from: map_obj.from,
      to: map_obj.to,
    });

    efen = this.efens[local_ix];
    if (DEBUG_FLAG) {
      console.log(map_obj);
    }
    //if (DEBUG_FLAG) {  console.log( xfen_prev ); }

    // make a deep copy of the xfen_p to modify
    xfen_curr = JSON.parse(JSON.stringify(xfen_prev));

    // if (DEBUG_FLAG) {  console.log( xfen_curr ); }
    // square by square blank out any that are now '.'
    for (ix = 0; ix < 64; ix++) {
      if (this.efens[local_ix][ix] == ".") {
        xfen_curr[ix] = ".";
      }
    }
    if (DEBUG_FLAG) {
      console.log(efen);
    }
    //if (DEBUG_FLAG) {  console.log( 'cur xfen : ', xfen_curr ); }
    //if (DEBUG_FLAG) {  console.log( display_xfen_debug( xfen_curr) ); }

    let lpiece = map_obj.piece.toLowerCase();
    let ppiece = ""; // have both lpiece and ppiece because ppiece is the piece prior to promo
    let lfrom = map_obj.from.toLowerCase();
    let lto = map_obj.to.toLowerCase();
    let lsan = map_obj.san.toLowerCase();
    let lcolor = map_obj.color.toLowerCase();
    let captured = "";
    let castling = false;
    let enpass = false;
    let promo = false;
    let capture = false;
    let castle_rook_to_ix = 0;

    let from_square_ix = squareCode2Idx(lfrom);

    ppiece = xfen_prev[from_square_ix][1];

    if (map_obj.hasOwnProperty("captured")) {
      captured = map_obj.captured.toLowerCase();
    }

    if (lsan.includes("o-o")) {
      castling = true;
    }
    if (ppiece == "p" && (lto[1] == "8" || lto[1] == "1")) {
      promo = true;
    }
    if (lsan.includes("x")) {
      capture = true;
    }
    if (lpiece == "p" && captured == "p" && (lto[1] == "6" || lto[1] == "3")) {
      // might be an enpassent case
      // and if the square we wound up on was empty previously
      if (xfen_prev[squareCode2Idx(lto)] == ".") {
        enpass = true;
        // need to determine which pawn was captured, or just know that it is now gone
        // since it will be removed from the board 3D array by the updates
      }
    }

    // ==============================================================================
    // #####     build the current xfen using the prior xfen,
    // #####     the current efen, and relevant san/move info
    // =============================================================================
    // let from_square_ix = 0;
    let to_ix = squareCode2Idx(lto);
    for (ix = 0; ix < 64; ix++) {
      lpiece = efen[ix]; //xfen_curr[ix];
      if (lpiece != ".") {
        // the moved piece identified in the lto/map_obj.to
        // which means all other pieces are just copied from .prev to .curr
        // thus for all squares not identified by lto just copy the prior piece
        // except for the 3 special cases: castele, enpass, promo?
        if (to_ix != ix) {
          xfen_curr[ix] = JSON.parse(JSON.stringify(xfen_prev[ix]));
        } else {
          // and for the one square identified by lto then copy the piece
          // identified in the lfrom
          // from_square_ix = squareCode2Idx( lfrom );
          xfen_curr[ix] = JSON.parse(JSON.stringify(xfen_prev[from_square_ix]));
          if (promo == true) {
            //handle numbering the newly promoted piece
            promoted = lsan.split("=")[1][0];
            console.log(promoted);
            promoted = promoted.concat(
              numberNewPiece(xfen_prev[from_square_ix][2])
            );
            promoted = lcolor.concat(promoted);
            xfen_curr[ix] = JSON.parse(JSON.stringify(promoted));
          }
          if (castling == true) {
            // just 4 possible move combos for castling so this can be hard-coded
            // wk1 to g1 , wr2 to f1
            // wki to c1 , wr1 to d1
            // bk1 to g8 , br2 to f8
            // bk2 to c8 , br1 to d8
            if (lto == "g1") {
              castle_rook_to_ix = squareCode2Idx("f1");
              xfen_curr[castle_rook_to_ix] = JSON.parse(JSON.stringify("wr2"));
            }
            if (lto == "c1") {
              castle_rook_to_ix = squareCode2Idx("d1");
              xfen_curr[castle_rook_to_ix] = JSON.parse(JSON.stringify("wr1"));
            }
            if (lto == "g8") {
              castle_rook_to_ix = squareCode2Idx("f8");
              xfen_curr[castle_rook_to_ix] = JSON.parse(JSON.stringify("br2"));
            }
            if (lto == "c8") {
              castle_rook_to_ix = squareCode2Idx("d8");
              xfen_curr[castle_rook_to_ix] = JSON.parse(JSON.stringify("br1"));
            }
          }
        }
      }
    }

    // push the new xfen onto the end of the array
    this.xfens.push(xfen_curr);

    if (DEBUG_FLAG) {
      console.log(display_xfen_debug(xfen_curr));
    }

    // prepare for next iteration through the half-move list (ply)
    local_ix++;
    xfen_prev = JSON.parse(JSON.stringify(xfen_curr));
    return map_obj;
  });

  if (DEBUG_FLAG) {
    for (ix = 0; ix < this.xfens.length; ix++) {
      console.log(this.xfens[ix]);
      for (ir = 0; ir < 8; ir++) {
        console.log(this.xfens[ix].slice(ir * 8, (ir + 1) * 8));
      }
    }
    let json_xfens = JSON.stringify(this.xfens);
    console.log(json_xfens);
  }
}

//======== TESTING GROUNDS =======

function CreateChessGame() {
  let pgn = validatePGN();
  let test = new ChessGame(pgn);

  // Clear XFEN and Debug table header/row to prevent duplication
  let tbody = document.getElementById("bdy100");
  tbody.innerHTML = "";
  let tr = document.getElementById("tr100");
  tr.innerHTML = "";
  let debugBody = document.getElementById("debug-body");
  debugBody.innerHTML = "";

  // Code Tester
  if (DEBUG_FLAG) {
    console.log(test.fens);
    console.log(test.efens);
    console.log(test.moves);
  }
  console.log("JSON Objects: ");
  console.log(JSON.stringify(test));
  console.log(test.xfens);

  let tbl = document.getElementById("bdy100");
  let trHeader = document.getElementById("tr100");
  let row = "";
  let cell = "";
  let conts = "";
  let inner = "";

  // xfen table header
  cell = trHeader.insertCell();
  cell.innerHTML = " ";
 
  for (i = 0; i <= 63; i++) {
    cell = trHeader.insertCell();
    conts = i.toString();
    if (conts.length < 2) {
      conts = "0" + conts;
    }
    conts = conts + "<br>" + squareXlat[i];
    cell.innerHTML = conts;
  }

  // xfen table body
  for (i = 0; i < test.xfens.length; i++) {
    row = tbl.insertRow();
    cell = row.insertCell();
    cell.innerHTML = (i+1).toString();
    for (cd = 0; cd <= 63; cd++) {
      cell = row.insertCell();
      conts = test.xfens[i][cd];
      inner =
        conts.substring(1, 2) +
        '<span class="supsub">' +
        "<sup>" +
        conts.substring(0, 1) +
        "</sup>" +
        "<sub>" +
        conts.substring(2, 3) +
        "</sub></span>";
      cell.innerHTML = inner;
    }
  }

  // Iterate through the arrays and populate each column
  for (let i = 0; i < test.history.length; i++) {
    // Create a new row
    const newRow = debugBody.insertRow();

    const turnCell = newRow.insertCell();
    turnCell.textContent = i + 1;

    const pgnCell = newRow.insertCell();
    pgnCell.textContent = test.history[i]["san"]; // Access each move's history object, access "to" key, get PGN of the turn

    const fromCell = newRow.insertCell();
    fromCell.textContent = test.history[i]["from"];

    const toCell = newRow.insertCell();
    toCell.textContent = test.history[i]["to"];

    const pieceCell = newRow.insertCell();
    pieceCell.textContent = test.history[i]["piece"];

    const colorCell = newRow.insertCell();
    colorCell.textContent = test.history[i]["color"];

    const xPieceCell = newRow.insertCell();
    let xPiecePos = squareCode2Idx(toCell.textContent); //Use "to" cell square code, get index, use index to get xpiece in xfens
    if (i == 30) {
      console.log(test.xfens[i + 1][xPiecePos]);
    }
    xPieceCell.textContent = test.xfens[i + 1][xPiecePos]; // i + 1 because first index of xfens is a starting config of chessboard.

    const fenCell = newRow.insertCell();
    fenCell.textContent = test.fens[i];
    fenCell.setAttribute("id", "FEN")
  }
}

function clearTables() {
  let tbody = document.getElementById("bdy100");
  tbody.innerHTML = "";
  let tr = document.getElementById("tr100");
  tr.innerHTML = "";
  let debugBody = document.getElementById("debug-body");
  debugBody.innerHTML = "";
}
