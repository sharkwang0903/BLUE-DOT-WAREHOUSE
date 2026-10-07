/* Hand-picked rooms; coordinates are zero-based [x, y]. See tools/verify.js. */
(function (root) {
  const levels = [
  {
    "id": 1,
    "name": "初光",
    "codename": "FIRST LIGHT",
    "map": [
      "######",
      "#    #",
      "# # .#",
      "#    #",
      "#    #",
      "######"
    ],
    "player": [
      1,
      3
    ],
    "boxes": [
      [
        2,
        3
      ]
    ]
  },
  {
    "id": 2,
    "name": "迴身",
    "codename": "TURNAROUND",
    "map": [
      "#######",
      "#  . ##",
      "# .#  #",
      "##    #",
      "#    ##",
      "#     #",
      "#######"
    ],
    "player": [
      5,
      3
    ],
    "boxes": [
      [
        4,
        2
      ],
      [
        4,
        3
      ]
    ]
  },
  {
    "id": 3,
    "name": "借道",
    "codename": "BORROWED SPACE",
    "map": [
      "########",
      "#  #   #",
      "#    # #",
      "# #    #",
      "#   # .#",
      "##    .#",
      "#    #.#",
      "########"
    ],
    "player": [
      3,
      2
    ],
    "boxes": [
      [
        3,
        3
      ],
      [
        2,
        4
      ],
      [
        2,
        5
      ]
    ]
  },
  {
    "id": 4,
    "name": "錯序",
    "codename": "OUT OF ORDER",
    "map": [
      "########",
      "# #.   #",
      "#  .   #",
      "# # #. #",
      "#  #  .#",
      "#      #",
      "#   #  #",
      "########"
    ],
    "player": [
      2,
      5
    ],
    "boxes": [
      [
        2,
        2
      ],
      [
        4,
        2
      ],
      [
        5,
        4
      ],
      [
        3,
        5
      ]
    ]
  },
  {
    "id": 5,
    "name": "交班",
    "codename": "CHANGING GUARD",
    "map": [
      "########",
      "#.   .##",
      "# .##  #",
      "#   o  #",
      "#|   ###",
      "#      #",
      "# # #  #",
      "########"
    ],
    "player": [
      6,
      3
    ],
    "boxes": [
      [
        5,
        2
      ],
      [
        5,
        3
      ],
      [
        4,
        4
      ]
    ]
  },
  {
    "id": 6,
    "name": "餘滑",
    "codename": "AFTER THE PUSH",
    "map": [
      "########",
      "#      #",
      "#.~*   #",
      "#  .# ##",
      "#      #",
      "#      #",
      "# # #  #",
      "########"
    ],
    "player": [
      5,
      3
    ],
    "boxes": [
      [
        5,
        4
      ],
      [
        2,
        5
      ],
      [
        4,
        5
      ]
    ]
  },
  {
    "id": 7,
    "name": "煞車",
    "codename": "THE LAST STOP",
    "map": [
      "########",
      "###  # #",
      "#    ~ #",
      "#   #*.#",
      "##   ~ #",
      "#   .~ #",
      "##     #",
      "########"
    ],
    "player": [
      6,
      2
    ],
    "boxes": [
      [
        2,
        2
      ],
      [
        5,
        2
      ],
      [
        2,
        5
      ]
    ]
  },
  {
    "id": 8,
    "name": "閉環",
    "codename": "CLOSED CIRCUIT",
    "map": [
      "########",
      "#  #~~~#",
      "#  #   #",
      "#     ##",
      "# #. # #",
      "#  ~ o.#",
      "# .|   #",
      "########"
    ],
    "player": [
      6,
      2
    ],
    "boxes": [
      [
        2,
        2
      ],
      [
        5,
        2
      ],
      [
        2,
        3
      ]
    ]
  },
  {
    "id": 9,
    "name": "穿針",
    "codename": "THREAD THE NEEDLE",
    "map": [
      "########",
      "##   # #",
      "#   o~.#",
      "#   #* #",
      "##~|~~ #",
      "#   .~##",
      "##    ##",
      "########"
    ],
    "player": [4, 5],
    "boxes": [[2, 2], [5, 2], [2, 5]]
  },
  {
    "id": 10,
    "name": "返照",
    "codename": "RETURN PATH",
    "map": [
      "########",
      "#   ~~~#",
      "#  #   #",
      "#     ##",
      "#~# ~#~#",
      "#* ~ o.#",
      "#~.|   #",
      "########"
    ],
    "player": [1, 2],
    "boxes": [[2, 2], [5, 2], [2, 3]]
  },
  {
    "id": 11,
    "name": "易位",
    "codename": "SWITCHING SIDES",
    "map": [
      "########",
      "###  # #",
      "#    ~ #",
      "# | #*.#",
      "##  o~~#",
      "## . ~ #",
      "##     #",
      "########"
    ],
    "player": [4, 5],
    "boxes": [[2, 2], [5, 2], [2, 5]]
  },
  {
    "id": 12,
    "name": "終局",
    "codename": "THE FINAL ARRANGEMENT",
    "map": [
      "########",
      "# #  # #",
      "#    ~ #",
      "# ~~#*.#",
      "##~~ ~|#",
      "# ~o.~ #",
      "##.  ###",
      "########"
    ],
    "player": [3, 6],
    "boxes": [[2, 2], [3, 2], [2, 5], [4, 4]]
  }
];
  if (typeof module === "object" && module.exports) module.exports = levels;
  else root.BlueBoxLevels = levels;
})(typeof globalThis !== "undefined" ? globalThis : this);
