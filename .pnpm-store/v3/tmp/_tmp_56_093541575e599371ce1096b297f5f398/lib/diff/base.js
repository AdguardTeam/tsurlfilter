/*istanbul ignore start*/
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = Diff;

/*istanbul ignore end*/
function Diff() {}

Diff.prototype = {
  /*istanbul ignore start*/

  /*istanbul ignore end*/
  diff: function diff(oldString, newString) {
    /*istanbul ignore start*/
    var
    /*istanbul ignore end*/
    options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var callback = options.callback;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    this.options = options;
    var self = this;

    function done(value) {
      if (callback) {
        setTimeout(function () {
          callback(undefined, value);
        }, 0);
        return true;
      } else {
        return value;
      }
    } // Allow subclasses to massage the input prior to running


    oldString = this.castInput(oldString);
    newString = this.castInput(newString);
    oldString = this.removeEmpty(this.tokenize(oldString));
    newString = this.removeEmpty(this.tokenize(newString));
    var newLen = newString.length,
        oldLen = oldString.length;
    var editLength = 1;
    var maxEditLength = newLen + oldLen;

    if (options.maxEditLength) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }

    var bestPath = [{
      oldPos: -1,
      lastComponent: undefined
    }]; // Seed editLength = 0, i.e. the content starts with the same values

    var newPos = this.extractCommon(bestPath[0], newString, oldString, 0);

    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      // Identity per the equality and tokenizer
      return done([{
        value: this.join(newString),
        count: newString.length
      }]);
    } // Once we hit the right edge of the edit graph on some diagonal k, we can
    // definitely reach the end of the edit graph in no more than k edits, so
    // there's no point in considering any moves to diagonal k+1 any more (from
    // which we're guaranteed to need at least k+1 more edits).
    // Similarly, once we've reached the bottom of the edit graph, there's no
    // point considering moves to lower diagonals.
    // We record this fact by setting minDiagonalToConsider and
    // maxDiagonalToConsider to some finite value once we've hit the edge of
    // the edit graph.
    // This optimization is not faithful to the original algorithm presented in
    // Myers's paper, which instead pointlessly extends D-paths off the end of
    // the edit graph - see page 7 of Myers's paper which notes this point
    // explicitly and illustrates it with a diagram. This has major performance
    // implications for some common scenarios. For instance, to compute a diff
    // where the new text simply appends d characters on the end of the
    // original text of length n, the true Myers algorithm will take O(n+d^2)
    // time while this optimization needs only O(n+d) time.


    var minDiagonalToConsider = -Infinity,
        maxDiagonalToConsider = Infinity; // Main worker method. checks all permutations of a given edit length for acceptance.

    function execEditLength() {
      for (var diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        var basePath =
        /*istanbul ignore start*/
        void 0
        /*istanbul ignore end*/
        ;
        var removePath = bestPath[diagonalPath - 1],
            addPath = bestPath[diagonalPath + 1];

        if (removePath) {
          // No one else is going to attempt to use this value, clear it
          bestPath[diagonalPath - 1] = undefined;
        }

        var canAdd = false;

        if (addPath) {
          // what newPos will be after we do an insertion:
          var addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }

        var canRemove = removePath && removePath.oldPos + 1 < oldLen;

        if (!canAdd && !canRemove) {
          // If this path is a terminal then prune
          bestPath[diagonalPath] = undefined;
          continue;
        } // Select the diagonal that we want to branch from. We select the prior
        // path whose position in the old string is the farthest from the origin
        // and does not pass the bounds of the diff graph
        // TODO: Remove the `+ 1` here to make behavior match Myers algorithm
        //       and prefer to order removals before insertions.


        if (!canRemove || canAdd && removePath.oldPos + 1 < addPath.oldPos) {
          basePath = self.addToPath(addPath, true, undefined, 0);
        } else {
          basePath = self.addToPath(removePath, undefined, true, 1);
        }

        newPos = self.extractCommon(basePath, newString, oldString, diagonalPath);

        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          // If we have hit the end of both strings, then we are done
          return done(buildValues(self, basePath.lastComponent, newString, oldString, self.useLongestToken));
        } else {
          bestPath[diagonalPath] = basePath;

          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }

          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }

      editLength++;
    } // Performs the length of edit iteration. Is a bit fugly as this has to support the
    // sync and async mode which is never fun. Loops over execEditLength until a value
    // is produced, or until the edit length exceeds options.maxEditLength (if given),
    // in which case it will return undefined.


    if (callback) {
      (function exec() {
        setTimeout(function () {
          if (editLength > maxEditLength) {
            return callback();
          }

          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength) {
        var ret = execEditLength();

        if (ret) {
          return ret;
        }
      }
    }
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  addToPath: function addToPath(path, added, removed, oldPosInc) {
    var last = path.lastComponent;

    if (last && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: {
          count: last.count + 1,
          added: added,
          removed: removed,
          previousComponent: last.previousComponent
        }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: {
          count: 1,
          added: added,
          removed: removed,
          previousComponent: last
        }
      };
    }
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
    var newLen = newString.length,
        oldLen = oldString.length,
        oldPos = basePath.oldPos,
        newPos = oldPos - diagonalPath,
        commonCount = 0;

    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
      newPos++;
      oldPos++;
      commonCount++;
    }

    if (commonCount) {
      basePath.lastComponent = {
        count: commonCount,
        previousComponent: basePath.lastComponent
      };
    }

    basePath.oldPos = oldPos;
    return newPos;
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  equals: function equals(left, right) {
    if (this.options.comparator) {
      return this.options.comparator(left, right);
    } else {
      return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  removeEmpty: function removeEmpty(array) {
    var ret = [];

    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }

    return ret;
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  castInput: function castInput(value) {
    return value;
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  tokenize: function tokenize(value) {
    return value.split('');
  },

  /*istanbul ignore start*/

  /*istanbul ignore end*/
  join: function join(chars) {
    return chars.join('');
  }
};

function buildValues(diff, lastComponent, newString, oldString, useLongestToken) {
  // First we convert our linked list of components in reverse order to an
  // array in the right order:
  var components = [];
  var nextComponent;

  while (lastComponent) {
    components.push(lastComponent);
    nextComponent = lastComponent.previousComponent;
    delete lastComponent.previousComponent;
    lastComponent = nextComponent;
  }

  components.reverse();
  var componentPos = 0,
      componentLen = components.length,
      newPos = 0,
      oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    var component = components[componentPos];

    if (!component.removed) {
      if (!component.added && useLongestToken) {
        var value = newString.slice(newPos, newPos + component.count);
        value = value.map(function (value, i) {
          var oldValue = oldString[oldPos + i];
          return oldValue.length > value.length ? oldValue : value;
        });
        component.value = diff.join(value);
      } else {
        component.value = diff.join(newString.slice(newPos, newPos + component.count));
      }

      newPos += component.count; // Common case

      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = diff.join(oldString.slice(oldPos, oldPos + component.count));
      oldPos += component.count; // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.

      if (componentPos && components[componentPos - 1].added) {
        var tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  } // Special case handle for when one terminal is ignored (i.e. whitespace).
  // For this case we merge the terminal into the prior string and drop the change.
  // This is only available for string mode.


  var finalComponent = components[componentLen - 1];

  if (componentLen > 1 && typeof finalComponent.value === 'string' && (finalComponent.added || finalComponent.removed) && diff.equals('', finalComponent.value)) {
    components[componentLen - 2].value += finalComponent.value;
    components.pop();
  }

  return components;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9kaWZmL2Jhc2UuanMiXSwibmFtZXMiOlsiRGlmZiIsInByb3RvdHlwZSIsImRpZmYiLCJvbGRTdHJpbmciLCJuZXdTdHJpbmciLCJvcHRpb25zIiwiY2FsbGJhY2siLCJzZWxmIiwiZG9uZSIsInZhbHVlIiwic2V0VGltZW91dCIsInVuZGVmaW5lZCIsImNhc3RJbnB1dCIsInJlbW92ZUVtcHR5IiwidG9rZW5pemUiLCJuZXdMZW4iLCJsZW5ndGgiLCJvbGRMZW4iLCJlZGl0TGVuZ3RoIiwibWF4RWRpdExlbmd0aCIsIk1hdGgiLCJtaW4iLCJiZXN0UGF0aCIsIm9sZFBvcyIsImxhc3RDb21wb25lbnQiLCJuZXdQb3MiLCJleHRyYWN0Q29tbW9uIiwiam9pbiIsImNvdW50IiwibWluRGlhZ29uYWxUb0NvbnNpZGVyIiwiSW5maW5pdHkiLCJtYXhEaWFnb25hbFRvQ29uc2lkZXIiLCJleGVjRWRpdExlbmd0aCIsImRpYWdvbmFsUGF0aCIsIm1heCIsImJhc2VQYXRoIiwicmVtb3ZlUGF0aCIsImFkZFBhdGgiLCJjYW5BZGQiLCJhZGRQYXRoTmV3UG9zIiwiY2FuUmVtb3ZlIiwiYWRkVG9QYXRoIiwiYnVpbGRWYWx1ZXMiLCJ1c2VMb25nZXN0VG9rZW4iLCJleGVjIiwicmV0IiwicGF0aCIsImFkZGVkIiwicmVtb3ZlZCIsIm9sZFBvc0luYyIsImxhc3QiLCJwcmV2aW91c0NvbXBvbmVudCIsImNvbW1vbkNvdW50IiwiZXF1YWxzIiwibGVmdCIsInJpZ2h0IiwiY29tcGFyYXRvciIsImlnbm9yZUNhc2UiLCJ0b0xvd2VyQ2FzZSIsImFycmF5IiwiaSIsInB1c2giLCJzcGxpdCIsImNoYXJzIiwiY29tcG9uZW50cyIsIm5leHRDb21wb25lbnQiLCJyZXZlcnNlIiwiY29tcG9uZW50UG9zIiwiY29tcG9uZW50TGVuIiwiY29tcG9uZW50Iiwic2xpY2UiLCJtYXAiLCJvbGRWYWx1ZSIsInRtcCIsImZpbmFsQ29tcG9uZW50IiwicG9wIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBZSxTQUFTQSxJQUFULEdBQWdCLENBQUU7O0FBRWpDQSxJQUFJLENBQUNDLFNBQUwsR0FBaUI7QUFBQTs7QUFBQTtBQUNmQyxFQUFBQSxJQURlLGdCQUNWQyxTQURVLEVBQ0NDLFNBREQsRUFDMEI7QUFBQTtBQUFBO0FBQUE7QUFBZEMsSUFBQUEsT0FBYyx1RUFBSixFQUFJO0FBQ3ZDLFFBQUlDLFFBQVEsR0FBR0QsT0FBTyxDQUFDQyxRQUF2Qjs7QUFDQSxRQUFJLE9BQU9ELE9BQVAsS0FBbUIsVUFBdkIsRUFBbUM7QUFDakNDLE1BQUFBLFFBQVEsR0FBR0QsT0FBWDtBQUNBQSxNQUFBQSxPQUFPLEdBQUcsRUFBVjtBQUNEOztBQUNELFNBQUtBLE9BQUwsR0FBZUEsT0FBZjtBQUVBLFFBQUlFLElBQUksR0FBRyxJQUFYOztBQUVBLGFBQVNDLElBQVQsQ0FBY0MsS0FBZCxFQUFxQjtBQUNuQixVQUFJSCxRQUFKLEVBQWM7QUFDWkksUUFBQUEsVUFBVSxDQUFDLFlBQVc7QUFBRUosVUFBQUEsUUFBUSxDQUFDSyxTQUFELEVBQVlGLEtBQVosQ0FBUjtBQUE2QixTQUEzQyxFQUE2QyxDQUE3QyxDQUFWO0FBQ0EsZUFBTyxJQUFQO0FBQ0QsT0FIRCxNQUdPO0FBQ0wsZUFBT0EsS0FBUDtBQUNEO0FBQ0YsS0FqQnNDLENBbUJ2Qzs7O0FBQ0FOLElBQUFBLFNBQVMsR0FBRyxLQUFLUyxTQUFMLENBQWVULFNBQWYsQ0FBWjtBQUNBQyxJQUFBQSxTQUFTLEdBQUcsS0FBS1EsU0FBTCxDQUFlUixTQUFmLENBQVo7QUFFQUQsSUFBQUEsU0FBUyxHQUFHLEtBQUtVLFdBQUwsQ0FBaUIsS0FBS0MsUUFBTCxDQUFjWCxTQUFkLENBQWpCLENBQVo7QUFDQUMsSUFBQUEsU0FBUyxHQUFHLEtBQUtTLFdBQUwsQ0FBaUIsS0FBS0MsUUFBTCxDQUFjVixTQUFkLENBQWpCLENBQVo7QUFFQSxRQUFJVyxNQUFNLEdBQUdYLFNBQVMsQ0FBQ1ksTUFBdkI7QUFBQSxRQUErQkMsTUFBTSxHQUFHZCxTQUFTLENBQUNhLE1BQWxEO0FBQ0EsUUFBSUUsVUFBVSxHQUFHLENBQWpCO0FBQ0EsUUFBSUMsYUFBYSxHQUFHSixNQUFNLEdBQUdFLE1BQTdCOztBQUNBLFFBQUdaLE9BQU8sQ0FBQ2MsYUFBWCxFQUEwQjtBQUN4QkEsTUFBQUEsYUFBYSxHQUFHQyxJQUFJLENBQUNDLEdBQUwsQ0FBU0YsYUFBVCxFQUF3QmQsT0FBTyxDQUFDYyxhQUFoQyxDQUFoQjtBQUNEOztBQUVELFFBQUlHLFFBQVEsR0FBRyxDQUFDO0FBQUVDLE1BQUFBLE1BQU0sRUFBRSxDQUFDLENBQVg7QUFBY0MsTUFBQUEsYUFBYSxFQUFFYjtBQUE3QixLQUFELENBQWYsQ0FqQ3VDLENBbUN2Qzs7QUFDQSxRQUFJYyxNQUFNLEdBQUcsS0FBS0MsYUFBTCxDQUFtQkosUUFBUSxDQUFDLENBQUQsQ0FBM0IsRUFBZ0NsQixTQUFoQyxFQUEyQ0QsU0FBM0MsRUFBc0QsQ0FBdEQsQ0FBYjs7QUFDQSxRQUFJbUIsUUFBUSxDQUFDLENBQUQsQ0FBUixDQUFZQyxNQUFaLEdBQXFCLENBQXJCLElBQTBCTixNQUExQixJQUFvQ1EsTUFBTSxHQUFHLENBQVQsSUFBY1YsTUFBdEQsRUFBOEQ7QUFDNUQ7QUFDQSxhQUFPUCxJQUFJLENBQUMsQ0FBQztBQUFDQyxRQUFBQSxLQUFLLEVBQUUsS0FBS2tCLElBQUwsQ0FBVXZCLFNBQVYsQ0FBUjtBQUE4QndCLFFBQUFBLEtBQUssRUFBRXhCLFNBQVMsQ0FBQ1k7QUFBL0MsT0FBRCxDQUFELENBQVg7QUFDRCxLQXhDc0MsQ0EwQ3ZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBLFFBQUlhLHFCQUFxQixHQUFHLENBQUNDLFFBQTdCO0FBQUEsUUFBdUNDLHFCQUFxQixHQUFHRCxRQUEvRCxDQTNEdUMsQ0E2RHZDOztBQUNBLGFBQVNFLGNBQVQsR0FBMEI7QUFDeEIsV0FDRSxJQUFJQyxZQUFZLEdBQUdiLElBQUksQ0FBQ2MsR0FBTCxDQUFTTCxxQkFBVCxFQUFnQyxDQUFDWCxVQUFqQyxDQURyQixFQUVFZSxZQUFZLElBQUliLElBQUksQ0FBQ0MsR0FBTCxDQUFTVSxxQkFBVCxFQUFnQ2IsVUFBaEMsQ0FGbEIsRUFHRWUsWUFBWSxJQUFJLENBSGxCLEVBSUU7QUFDQSxZQUFJRSxRQUFRO0FBQUE7QUFBQTtBQUFaO0FBQUE7QUFDQSxZQUFJQyxVQUFVLEdBQUdkLFFBQVEsQ0FBQ1csWUFBWSxHQUFHLENBQWhCLENBQXpCO0FBQUEsWUFDSUksT0FBTyxHQUFHZixRQUFRLENBQUNXLFlBQVksR0FBRyxDQUFoQixDQUR0Qjs7QUFFQSxZQUFJRyxVQUFKLEVBQWdCO0FBQ2Q7QUFDQWQsVUFBQUEsUUFBUSxDQUFDVyxZQUFZLEdBQUcsQ0FBaEIsQ0FBUixHQUE2QnRCLFNBQTdCO0FBQ0Q7O0FBRUQsWUFBSTJCLE1BQU0sR0FBRyxLQUFiOztBQUNBLFlBQUlELE9BQUosRUFBYTtBQUNYO0FBQ0EsY0FBTUUsYUFBYSxHQUFHRixPQUFPLENBQUNkLE1BQVIsR0FBaUJVLFlBQXZDO0FBQ0FLLFVBQUFBLE1BQU0sR0FBR0QsT0FBTyxJQUFJLEtBQUtFLGFBQWhCLElBQWlDQSxhQUFhLEdBQUd4QixNQUExRDtBQUNEOztBQUVELFlBQUl5QixTQUFTLEdBQUdKLFVBQVUsSUFBSUEsVUFBVSxDQUFDYixNQUFYLEdBQW9CLENBQXBCLEdBQXdCTixNQUF0RDs7QUFDQSxZQUFJLENBQUNxQixNQUFELElBQVcsQ0FBQ0UsU0FBaEIsRUFBMkI7QUFDekI7QUFDQWxCLFVBQUFBLFFBQVEsQ0FBQ1csWUFBRCxDQUFSLEdBQXlCdEIsU0FBekI7QUFDQTtBQUNELFNBckJELENBdUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUNBLFlBQUksQ0FBQzZCLFNBQUQsSUFBZUYsTUFBTSxJQUFJRixVQUFVLENBQUNiLE1BQVgsR0FBb0IsQ0FBcEIsR0FBd0JjLE9BQU8sQ0FBQ2QsTUFBN0QsRUFBc0U7QUFDcEVZLFVBQUFBLFFBQVEsR0FBRzVCLElBQUksQ0FBQ2tDLFNBQUwsQ0FBZUosT0FBZixFQUF3QixJQUF4QixFQUE4QjFCLFNBQTlCLEVBQXlDLENBQXpDLENBQVg7QUFDRCxTQUZELE1BRU87QUFDTHdCLFVBQUFBLFFBQVEsR0FBRzVCLElBQUksQ0FBQ2tDLFNBQUwsQ0FBZUwsVUFBZixFQUEyQnpCLFNBQTNCLEVBQXNDLElBQXRDLEVBQTRDLENBQTVDLENBQVg7QUFDRDs7QUFFRGMsUUFBQUEsTUFBTSxHQUFHbEIsSUFBSSxDQUFDbUIsYUFBTCxDQUFtQlMsUUFBbkIsRUFBNkIvQixTQUE3QixFQUF3Q0QsU0FBeEMsRUFBbUQ4QixZQUFuRCxDQUFUOztBQUVBLFlBQUlFLFFBQVEsQ0FBQ1osTUFBVCxHQUFrQixDQUFsQixJQUF1Qk4sTUFBdkIsSUFBaUNRLE1BQU0sR0FBRyxDQUFULElBQWNWLE1BQW5ELEVBQTJEO0FBQ3pEO0FBQ0EsaUJBQU9QLElBQUksQ0FBQ2tDLFdBQVcsQ0FBQ25DLElBQUQsRUFBTzRCLFFBQVEsQ0FBQ1gsYUFBaEIsRUFBK0JwQixTQUEvQixFQUEwQ0QsU0FBMUMsRUFBcURJLElBQUksQ0FBQ29DLGVBQTFELENBQVosQ0FBWDtBQUNELFNBSEQsTUFHTztBQUNMckIsVUFBQUEsUUFBUSxDQUFDVyxZQUFELENBQVIsR0FBeUJFLFFBQXpCOztBQUNBLGNBQUlBLFFBQVEsQ0FBQ1osTUFBVCxHQUFrQixDQUFsQixJQUF1Qk4sTUFBM0IsRUFBbUM7QUFDakNjLFlBQUFBLHFCQUFxQixHQUFHWCxJQUFJLENBQUNDLEdBQUwsQ0FBU1UscUJBQVQsRUFBZ0NFLFlBQVksR0FBRyxDQUEvQyxDQUF4QjtBQUNEOztBQUNELGNBQUlSLE1BQU0sR0FBRyxDQUFULElBQWNWLE1BQWxCLEVBQTBCO0FBQ3hCYyxZQUFBQSxxQkFBcUIsR0FBR1QsSUFBSSxDQUFDYyxHQUFMLENBQVNMLHFCQUFULEVBQWdDSSxZQUFZLEdBQUcsQ0FBL0MsQ0FBeEI7QUFDRDtBQUNGO0FBQ0Y7O0FBRURmLE1BQUFBLFVBQVU7QUFDWCxLQXRIc0MsQ0F3SHZDO0FBQ0E7QUFDQTtBQUNBOzs7QUFDQSxRQUFJWixRQUFKLEVBQWM7QUFDWCxnQkFBU3NDLElBQVQsR0FBZ0I7QUFDZmxDLFFBQUFBLFVBQVUsQ0FBQyxZQUFXO0FBQ3BCLGNBQUlRLFVBQVUsR0FBR0MsYUFBakIsRUFBZ0M7QUFDOUIsbUJBQU9iLFFBQVEsRUFBZjtBQUNEOztBQUVELGNBQUksQ0FBQzBCLGNBQWMsRUFBbkIsRUFBdUI7QUFDckJZLFlBQUFBLElBQUk7QUFDTDtBQUNGLFNBUlMsRUFRUCxDQVJPLENBQVY7QUFTRCxPQVZBLEdBQUQ7QUFXRCxLQVpELE1BWU87QUFDTCxhQUFPMUIsVUFBVSxJQUFJQyxhQUFyQixFQUFvQztBQUNsQyxZQUFJMEIsR0FBRyxHQUFHYixjQUFjLEVBQXhCOztBQUNBLFlBQUlhLEdBQUosRUFBUztBQUNQLGlCQUFPQSxHQUFQO0FBQ0Q7QUFDRjtBQUNGO0FBQ0YsR0FqSmM7O0FBQUE7O0FBQUE7QUFtSmZKLEVBQUFBLFNBbkplLHFCQW1KTEssSUFuSkssRUFtSkNDLEtBbkpELEVBbUpRQyxPQW5KUixFQW1KaUJDLFNBbkpqQixFQW1KNEI7QUFDekMsUUFBSUMsSUFBSSxHQUFHSixJQUFJLENBQUN0QixhQUFoQjs7QUFDQSxRQUFJMEIsSUFBSSxJQUFJQSxJQUFJLENBQUNILEtBQUwsS0FBZUEsS0FBdkIsSUFBZ0NHLElBQUksQ0FBQ0YsT0FBTCxLQUFpQkEsT0FBckQsRUFBOEQ7QUFDNUQsYUFBTztBQUNMekIsUUFBQUEsTUFBTSxFQUFFdUIsSUFBSSxDQUFDdkIsTUFBTCxHQUFjMEIsU0FEakI7QUFFTHpCLFFBQUFBLGFBQWEsRUFBRTtBQUFDSSxVQUFBQSxLQUFLLEVBQUVzQixJQUFJLENBQUN0QixLQUFMLEdBQWEsQ0FBckI7QUFBd0JtQixVQUFBQSxLQUFLLEVBQUVBLEtBQS9CO0FBQXNDQyxVQUFBQSxPQUFPLEVBQUVBLE9BQS9DO0FBQXdERyxVQUFBQSxpQkFBaUIsRUFBRUQsSUFBSSxDQUFDQztBQUFoRjtBQUZWLE9BQVA7QUFJRCxLQUxELE1BS087QUFDTCxhQUFPO0FBQ0w1QixRQUFBQSxNQUFNLEVBQUV1QixJQUFJLENBQUN2QixNQUFMLEdBQWMwQixTQURqQjtBQUVMekIsUUFBQUEsYUFBYSxFQUFFO0FBQUNJLFVBQUFBLEtBQUssRUFBRSxDQUFSO0FBQVdtQixVQUFBQSxLQUFLLEVBQUVBLEtBQWxCO0FBQXlCQyxVQUFBQSxPQUFPLEVBQUVBLE9BQWxDO0FBQTJDRyxVQUFBQSxpQkFBaUIsRUFBRUQ7QUFBOUQ7QUFGVixPQUFQO0FBSUQ7QUFDRixHQWhLYzs7QUFBQTs7QUFBQTtBQWlLZnhCLEVBQUFBLGFBaktlLHlCQWlLRFMsUUFqS0MsRUFpS1MvQixTQWpLVCxFQWlLb0JELFNBaktwQixFQWlLK0I4QixZQWpLL0IsRUFpSzZDO0FBQzFELFFBQUlsQixNQUFNLEdBQUdYLFNBQVMsQ0FBQ1ksTUFBdkI7QUFBQSxRQUNJQyxNQUFNLEdBQUdkLFNBQVMsQ0FBQ2EsTUFEdkI7QUFBQSxRQUVJTyxNQUFNLEdBQUdZLFFBQVEsQ0FBQ1osTUFGdEI7QUFBQSxRQUdJRSxNQUFNLEdBQUdGLE1BQU0sR0FBR1UsWUFIdEI7QUFBQSxRQUtJbUIsV0FBVyxHQUFHLENBTGxCOztBQU1BLFdBQU8zQixNQUFNLEdBQUcsQ0FBVCxHQUFhVixNQUFiLElBQXVCUSxNQUFNLEdBQUcsQ0FBVCxHQUFhTixNQUFwQyxJQUE4QyxLQUFLb0MsTUFBTCxDQUFZakQsU0FBUyxDQUFDcUIsTUFBTSxHQUFHLENBQVYsQ0FBckIsRUFBbUN0QixTQUFTLENBQUNvQixNQUFNLEdBQUcsQ0FBVixDQUE1QyxDQUFyRCxFQUFnSDtBQUM5R0UsTUFBQUEsTUFBTTtBQUNORixNQUFBQSxNQUFNO0FBQ042QixNQUFBQSxXQUFXO0FBQ1o7O0FBRUQsUUFBSUEsV0FBSixFQUFpQjtBQUNmakIsTUFBQUEsUUFBUSxDQUFDWCxhQUFULEdBQXlCO0FBQUNJLFFBQUFBLEtBQUssRUFBRXdCLFdBQVI7QUFBcUJELFFBQUFBLGlCQUFpQixFQUFFaEIsUUFBUSxDQUFDWDtBQUFqRCxPQUF6QjtBQUNEOztBQUVEVyxJQUFBQSxRQUFRLENBQUNaLE1BQVQsR0FBa0JBLE1BQWxCO0FBQ0EsV0FBT0UsTUFBUDtBQUNELEdBcExjOztBQUFBOztBQUFBO0FBc0xmNEIsRUFBQUEsTUF0TGUsa0JBc0xSQyxJQXRMUSxFQXNMRkMsS0F0TEUsRUFzTEs7QUFDbEIsUUFBSSxLQUFLbEQsT0FBTCxDQUFhbUQsVUFBakIsRUFBNkI7QUFDM0IsYUFBTyxLQUFLbkQsT0FBTCxDQUFhbUQsVUFBYixDQUF3QkYsSUFBeEIsRUFBOEJDLEtBQTlCLENBQVA7QUFDRCxLQUZELE1BRU87QUFDTCxhQUFPRCxJQUFJLEtBQUtDLEtBQVQsSUFDRCxLQUFLbEQsT0FBTCxDQUFhb0QsVUFBYixJQUEyQkgsSUFBSSxDQUFDSSxXQUFMLE9BQXVCSCxLQUFLLENBQUNHLFdBQU4sRUFEeEQ7QUFFRDtBQUNGLEdBN0xjOztBQUFBOztBQUFBO0FBOExmN0MsRUFBQUEsV0E5TGUsdUJBOExIOEMsS0E5TEcsRUE4TEk7QUFDakIsUUFBSWQsR0FBRyxHQUFHLEVBQVY7O0FBQ0EsU0FBSyxJQUFJZSxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRCxLQUFLLENBQUMzQyxNQUExQixFQUFrQzRDLENBQUMsRUFBbkMsRUFBdUM7QUFDckMsVUFBSUQsS0FBSyxDQUFDQyxDQUFELENBQVQsRUFBYztBQUNaZixRQUFBQSxHQUFHLENBQUNnQixJQUFKLENBQVNGLEtBQUssQ0FBQ0MsQ0FBRCxDQUFkO0FBQ0Q7QUFDRjs7QUFDRCxXQUFPZixHQUFQO0FBQ0QsR0F0TWM7O0FBQUE7O0FBQUE7QUF1TWZqQyxFQUFBQSxTQXZNZSxxQkF1TUxILEtBdk1LLEVBdU1FO0FBQ2YsV0FBT0EsS0FBUDtBQUNELEdBek1jOztBQUFBOztBQUFBO0FBME1mSyxFQUFBQSxRQTFNZSxvQkEwTU5MLEtBMU1NLEVBME1DO0FBQ2QsV0FBT0EsS0FBSyxDQUFDcUQsS0FBTixDQUFZLEVBQVosQ0FBUDtBQUNELEdBNU1jOztBQUFBOztBQUFBO0FBNk1mbkMsRUFBQUEsSUE3TWUsZ0JBNk1Wb0MsS0E3TVUsRUE2TUg7QUFDVixXQUFPQSxLQUFLLENBQUNwQyxJQUFOLENBQVcsRUFBWCxDQUFQO0FBQ0Q7QUEvTWMsQ0FBakI7O0FBa05BLFNBQVNlLFdBQVQsQ0FBcUJ4QyxJQUFyQixFQUEyQnNCLGFBQTNCLEVBQTBDcEIsU0FBMUMsRUFBcURELFNBQXJELEVBQWdFd0MsZUFBaEUsRUFBaUY7QUFDL0U7QUFDQTtBQUNBLE1BQU1xQixVQUFVLEdBQUcsRUFBbkI7QUFDQSxNQUFJQyxhQUFKOztBQUNBLFNBQU96QyxhQUFQLEVBQXNCO0FBQ3BCd0MsSUFBQUEsVUFBVSxDQUFDSCxJQUFYLENBQWdCckMsYUFBaEI7QUFDQXlDLElBQUFBLGFBQWEsR0FBR3pDLGFBQWEsQ0FBQzJCLGlCQUE5QjtBQUNBLFdBQU8zQixhQUFhLENBQUMyQixpQkFBckI7QUFDQTNCLElBQUFBLGFBQWEsR0FBR3lDLGFBQWhCO0FBQ0Q7O0FBQ0RELEVBQUFBLFVBQVUsQ0FBQ0UsT0FBWDtBQUVBLE1BQUlDLFlBQVksR0FBRyxDQUFuQjtBQUFBLE1BQ0lDLFlBQVksR0FBR0osVUFBVSxDQUFDaEQsTUFEOUI7QUFBQSxNQUVJUyxNQUFNLEdBQUcsQ0FGYjtBQUFBLE1BR0lGLE1BQU0sR0FBRyxDQUhiOztBQUtBLFNBQU80QyxZQUFZLEdBQUdDLFlBQXRCLEVBQW9DRCxZQUFZLEVBQWhELEVBQW9EO0FBQ2xELFFBQUlFLFNBQVMsR0FBR0wsVUFBVSxDQUFDRyxZQUFELENBQTFCOztBQUNBLFFBQUksQ0FBQ0UsU0FBUyxDQUFDckIsT0FBZixFQUF3QjtBQUN0QixVQUFJLENBQUNxQixTQUFTLENBQUN0QixLQUFYLElBQW9CSixlQUF4QixFQUF5QztBQUN2QyxZQUFJbEMsS0FBSyxHQUFHTCxTQUFTLENBQUNrRSxLQUFWLENBQWdCN0MsTUFBaEIsRUFBd0JBLE1BQU0sR0FBRzRDLFNBQVMsQ0FBQ3pDLEtBQTNDLENBQVo7QUFDQW5CLFFBQUFBLEtBQUssR0FBR0EsS0FBSyxDQUFDOEQsR0FBTixDQUFVLFVBQVM5RCxLQUFULEVBQWdCbUQsQ0FBaEIsRUFBbUI7QUFDbkMsY0FBSVksUUFBUSxHQUFHckUsU0FBUyxDQUFDb0IsTUFBTSxHQUFHcUMsQ0FBVixDQUF4QjtBQUNBLGlCQUFPWSxRQUFRLENBQUN4RCxNQUFULEdBQWtCUCxLQUFLLENBQUNPLE1BQXhCLEdBQWlDd0QsUUFBakMsR0FBNEMvRCxLQUFuRDtBQUNELFNBSE8sQ0FBUjtBQUtBNEQsUUFBQUEsU0FBUyxDQUFDNUQsS0FBVixHQUFrQlAsSUFBSSxDQUFDeUIsSUFBTCxDQUFVbEIsS0FBVixDQUFsQjtBQUNELE9BUkQsTUFRTztBQUNMNEQsUUFBQUEsU0FBUyxDQUFDNUQsS0FBVixHQUFrQlAsSUFBSSxDQUFDeUIsSUFBTCxDQUFVdkIsU0FBUyxDQUFDa0UsS0FBVixDQUFnQjdDLE1BQWhCLEVBQXdCQSxNQUFNLEdBQUc0QyxTQUFTLENBQUN6QyxLQUEzQyxDQUFWLENBQWxCO0FBQ0Q7O0FBQ0RILE1BQUFBLE1BQU0sSUFBSTRDLFNBQVMsQ0FBQ3pDLEtBQXBCLENBWnNCLENBY3RCOztBQUNBLFVBQUksQ0FBQ3lDLFNBQVMsQ0FBQ3RCLEtBQWYsRUFBc0I7QUFDcEJ4QixRQUFBQSxNQUFNLElBQUk4QyxTQUFTLENBQUN6QyxLQUFwQjtBQUNEO0FBQ0YsS0FsQkQsTUFrQk87QUFDTHlDLE1BQUFBLFNBQVMsQ0FBQzVELEtBQVYsR0FBa0JQLElBQUksQ0FBQ3lCLElBQUwsQ0FBVXhCLFNBQVMsQ0FBQ21FLEtBQVYsQ0FBZ0IvQyxNQUFoQixFQUF3QkEsTUFBTSxHQUFHOEMsU0FBUyxDQUFDekMsS0FBM0MsQ0FBVixDQUFsQjtBQUNBTCxNQUFBQSxNQUFNLElBQUk4QyxTQUFTLENBQUN6QyxLQUFwQixDQUZLLENBSUw7QUFDQTtBQUNBOztBQUNBLFVBQUl1QyxZQUFZLElBQUlILFVBQVUsQ0FBQ0csWUFBWSxHQUFHLENBQWhCLENBQVYsQ0FBNkJwQixLQUFqRCxFQUF3RDtBQUN0RCxZQUFJMEIsR0FBRyxHQUFHVCxVQUFVLENBQUNHLFlBQVksR0FBRyxDQUFoQixDQUFwQjtBQUNBSCxRQUFBQSxVQUFVLENBQUNHLFlBQVksR0FBRyxDQUFoQixDQUFWLEdBQStCSCxVQUFVLENBQUNHLFlBQUQsQ0FBekM7QUFDQUgsUUFBQUEsVUFBVSxDQUFDRyxZQUFELENBQVYsR0FBMkJNLEdBQTNCO0FBQ0Q7QUFDRjtBQUNGLEdBbkQ4RSxDQXFEL0U7QUFDQTtBQUNBOzs7QUFDQSxNQUFJQyxjQUFjLEdBQUdWLFVBQVUsQ0FBQ0ksWUFBWSxHQUFHLENBQWhCLENBQS9COztBQUNBLE1BQUlBLFlBQVksR0FBRyxDQUFmLElBQ0csT0FBT00sY0FBYyxDQUFDakUsS0FBdEIsS0FBZ0MsUUFEbkMsS0FFSWlFLGNBQWMsQ0FBQzNCLEtBQWYsSUFBd0IyQixjQUFjLENBQUMxQixPQUYzQyxLQUdHOUMsSUFBSSxDQUFDbUQsTUFBTCxDQUFZLEVBQVosRUFBZ0JxQixjQUFjLENBQUNqRSxLQUEvQixDQUhQLEVBRzhDO0FBQzVDdUQsSUFBQUEsVUFBVSxDQUFDSSxZQUFZLEdBQUcsQ0FBaEIsQ0FBVixDQUE2QjNELEtBQTdCLElBQXNDaUUsY0FBYyxDQUFDakUsS0FBckQ7QUFDQXVELElBQUFBLFVBQVUsQ0FBQ1csR0FBWDtBQUNEOztBQUVELFNBQU9YLFVBQVA7QUFDRCIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIERpZmYoKSB7fVxuXG5EaWZmLnByb3RvdHlwZSA9IHtcbiAgZGlmZihvbGRTdHJpbmcsIG5ld1N0cmluZywgb3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIGRvbmUodmFsdWUpIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayh1bmRlZmluZWQsIHZhbHVlKTsgfSwgMCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFsbG93IHN1YmNsYXNzZXMgdG8gbWFzc2FnZSB0aGUgaW5wdXQgcHJpb3IgdG8gcnVubmluZ1xuICAgIG9sZFN0cmluZyA9IHRoaXMuY2FzdElucHV0KG9sZFN0cmluZyk7XG4gICAgbmV3U3RyaW5nID0gdGhpcy5jYXN0SW5wdXQobmV3U3RyaW5nKTtcblxuICAgIG9sZFN0cmluZyA9IHRoaXMucmVtb3ZlRW1wdHkodGhpcy50b2tlbml6ZShvbGRTdHJpbmcpKTtcbiAgICBuZXdTdHJpbmcgPSB0aGlzLnJlbW92ZUVtcHR5KHRoaXMudG9rZW5pemUobmV3U3RyaW5nKSk7XG5cbiAgICBsZXQgbmV3TGVuID0gbmV3U3RyaW5nLmxlbmd0aCwgb2xkTGVuID0gb2xkU3RyaW5nLmxlbmd0aDtcbiAgICBsZXQgZWRpdExlbmd0aCA9IDE7XG4gICAgbGV0IG1heEVkaXRMZW5ndGggPSBuZXdMZW4gKyBvbGRMZW47XG4gICAgaWYob3B0aW9ucy5tYXhFZGl0TGVuZ3RoKSB7XG4gICAgICBtYXhFZGl0TGVuZ3RoID0gTWF0aC5taW4obWF4RWRpdExlbmd0aCwgb3B0aW9ucy5tYXhFZGl0TGVuZ3RoKTtcbiAgICB9XG5cbiAgICBsZXQgYmVzdFBhdGggPSBbeyBvbGRQb3M6IC0xLCBsYXN0Q29tcG9uZW50OiB1bmRlZmluZWQgfV07XG5cbiAgICAvLyBTZWVkIGVkaXRMZW5ndGggPSAwLCBpLmUuIHRoZSBjb250ZW50IHN0YXJ0cyB3aXRoIHRoZSBzYW1lIHZhbHVlc1xuICAgIGxldCBuZXdQb3MgPSB0aGlzLmV4dHJhY3RDb21tb24oYmVzdFBhdGhbMF0sIG5ld1N0cmluZywgb2xkU3RyaW5nLCAwKTtcbiAgICBpZiAoYmVzdFBhdGhbMF0ub2xkUG9zICsgMSA+PSBvbGRMZW4gJiYgbmV3UG9zICsgMSA+PSBuZXdMZW4pIHtcbiAgICAgIC8vIElkZW50aXR5IHBlciB0aGUgZXF1YWxpdHkgYW5kIHRva2VuaXplclxuICAgICAgcmV0dXJuIGRvbmUoW3t2YWx1ZTogdGhpcy5qb2luKG5ld1N0cmluZyksIGNvdW50OiBuZXdTdHJpbmcubGVuZ3RofV0pO1xuICAgIH1cblxuICAgIC8vIE9uY2Ugd2UgaGl0IHRoZSByaWdodCBlZGdlIG9mIHRoZSBlZGl0IGdyYXBoIG9uIHNvbWUgZGlhZ29uYWwgaywgd2UgY2FuXG4gICAgLy8gZGVmaW5pdGVseSByZWFjaCB0aGUgZW5kIG9mIHRoZSBlZGl0IGdyYXBoIGluIG5vIG1vcmUgdGhhbiBrIGVkaXRzLCBzb1xuICAgIC8vIHRoZXJlJ3Mgbm8gcG9pbnQgaW4gY29uc2lkZXJpbmcgYW55IG1vdmVzIHRvIGRpYWdvbmFsIGsrMSBhbnkgbW9yZSAoZnJvbVxuICAgIC8vIHdoaWNoIHdlJ3JlIGd1YXJhbnRlZWQgdG8gbmVlZCBhdCBsZWFzdCBrKzEgbW9yZSBlZGl0cykuXG4gICAgLy8gU2ltaWxhcmx5LCBvbmNlIHdlJ3ZlIHJlYWNoZWQgdGhlIGJvdHRvbSBvZiB0aGUgZWRpdCBncmFwaCwgdGhlcmUncyBub1xuICAgIC8vIHBvaW50IGNvbnNpZGVyaW5nIG1vdmVzIHRvIGxvd2VyIGRpYWdvbmFscy5cbiAgICAvLyBXZSByZWNvcmQgdGhpcyBmYWN0IGJ5IHNldHRpbmcgbWluRGlhZ29uYWxUb0NvbnNpZGVyIGFuZFxuICAgIC8vIG1heERpYWdvbmFsVG9Db25zaWRlciB0byBzb21lIGZpbml0ZSB2YWx1ZSBvbmNlIHdlJ3ZlIGhpdCB0aGUgZWRnZSBvZlxuICAgIC8vIHRoZSBlZGl0IGdyYXBoLlxuICAgIC8vIFRoaXMgb3B0aW1pemF0aW9uIGlzIG5vdCBmYWl0aGZ1bCB0byB0aGUgb3JpZ2luYWwgYWxnb3JpdGhtIHByZXNlbnRlZCBpblxuICAgIC8vIE15ZXJzJ3MgcGFwZXIsIHdoaWNoIGluc3RlYWQgcG9pbnRsZXNzbHkgZXh0ZW5kcyBELXBhdGhzIG9mZiB0aGUgZW5kIG9mXG4gICAgLy8gdGhlIGVkaXQgZ3JhcGggLSBzZWUgcGFnZSA3IG9mIE15ZXJzJ3MgcGFwZXIgd2hpY2ggbm90ZXMgdGhpcyBwb2ludFxuICAgIC8vIGV4cGxpY2l0bHkgYW5kIGlsbHVzdHJhdGVzIGl0IHdpdGggYSBkaWFncmFtLiBUaGlzIGhhcyBtYWpvciBwZXJmb3JtYW5jZVxuICAgIC8vIGltcGxpY2F0aW9ucyBmb3Igc29tZSBjb21tb24gc2NlbmFyaW9zLiBGb3IgaW5zdGFuY2UsIHRvIGNvbXB1dGUgYSBkaWZmXG4gICAgLy8gd2hlcmUgdGhlIG5ldyB0ZXh0IHNpbXBseSBhcHBlbmRzIGQgY2hhcmFjdGVycyBvbiB0aGUgZW5kIG9mIHRoZVxuICAgIC8vIG9yaWdpbmFsIHRleHQgb2YgbGVuZ3RoIG4sIHRoZSB0cnVlIE15ZXJzIGFsZ29yaXRobSB3aWxsIHRha2UgTyhuK2ReMilcbiAgICAvLyB0aW1lIHdoaWxlIHRoaXMgb3B0aW1pemF0aW9uIG5lZWRzIG9ubHkgTyhuK2QpIHRpbWUuXG4gICAgbGV0IG1pbkRpYWdvbmFsVG9Db25zaWRlciA9IC1JbmZpbml0eSwgbWF4RGlhZ29uYWxUb0NvbnNpZGVyID0gSW5maW5pdHk7XG5cbiAgICAvLyBNYWluIHdvcmtlciBtZXRob2QuIGNoZWNrcyBhbGwgcGVybXV0YXRpb25zIG9mIGEgZ2l2ZW4gZWRpdCBsZW5ndGggZm9yIGFjY2VwdGFuY2UuXG4gICAgZnVuY3Rpb24gZXhlY0VkaXRMZW5ndGgoKSB7XG4gICAgICBmb3IgKFxuICAgICAgICBsZXQgZGlhZ29uYWxQYXRoID0gTWF0aC5tYXgobWluRGlhZ29uYWxUb0NvbnNpZGVyLCAtZWRpdExlbmd0aCk7XG4gICAgICAgIGRpYWdvbmFsUGF0aCA8PSBNYXRoLm1pbihtYXhEaWFnb25hbFRvQ29uc2lkZXIsIGVkaXRMZW5ndGgpO1xuICAgICAgICBkaWFnb25hbFBhdGggKz0gMlxuICAgICAgKSB7XG4gICAgICAgIGxldCBiYXNlUGF0aDtcbiAgICAgICAgbGV0IHJlbW92ZVBhdGggPSBiZXN0UGF0aFtkaWFnb25hbFBhdGggLSAxXSxcbiAgICAgICAgICAgIGFkZFBhdGggPSBiZXN0UGF0aFtkaWFnb25hbFBhdGggKyAxXTtcbiAgICAgICAgaWYgKHJlbW92ZVBhdGgpIHtcbiAgICAgICAgICAvLyBObyBvbmUgZWxzZSBpcyBnb2luZyB0byBhdHRlbXB0IHRvIHVzZSB0aGlzIHZhbHVlLCBjbGVhciBpdFxuICAgICAgICAgIGJlc3RQYXRoW2RpYWdvbmFsUGF0aCAtIDFdID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNhbkFkZCA9IGZhbHNlO1xuICAgICAgICBpZiAoYWRkUGF0aCkge1xuICAgICAgICAgIC8vIHdoYXQgbmV3UG9zIHdpbGwgYmUgYWZ0ZXIgd2UgZG8gYW4gaW5zZXJ0aW9uOlxuICAgICAgICAgIGNvbnN0IGFkZFBhdGhOZXdQb3MgPSBhZGRQYXRoLm9sZFBvcyAtIGRpYWdvbmFsUGF0aDtcbiAgICAgICAgICBjYW5BZGQgPSBhZGRQYXRoICYmIDAgPD0gYWRkUGF0aE5ld1BvcyAmJiBhZGRQYXRoTmV3UG9zIDwgbmV3TGVuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNhblJlbW92ZSA9IHJlbW92ZVBhdGggJiYgcmVtb3ZlUGF0aC5vbGRQb3MgKyAxIDwgb2xkTGVuO1xuICAgICAgICBpZiAoIWNhbkFkZCAmJiAhY2FuUmVtb3ZlKSB7XG4gICAgICAgICAgLy8gSWYgdGhpcyBwYXRoIGlzIGEgdGVybWluYWwgdGhlbiBwcnVuZVxuICAgICAgICAgIGJlc3RQYXRoW2RpYWdvbmFsUGF0aF0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZWxlY3QgdGhlIGRpYWdvbmFsIHRoYXQgd2Ugd2FudCB0byBicmFuY2ggZnJvbS4gV2Ugc2VsZWN0IHRoZSBwcmlvclxuICAgICAgICAvLyBwYXRoIHdob3NlIHBvc2l0aW9uIGluIHRoZSBvbGQgc3RyaW5nIGlzIHRoZSBmYXJ0aGVzdCBmcm9tIHRoZSBvcmlnaW5cbiAgICAgICAgLy8gYW5kIGRvZXMgbm90IHBhc3MgdGhlIGJvdW5kcyBvZiB0aGUgZGlmZiBncmFwaFxuICAgICAgICAvLyBUT0RPOiBSZW1vdmUgdGhlIGArIDFgIGhlcmUgdG8gbWFrZSBiZWhhdmlvciBtYXRjaCBNeWVycyBhbGdvcml0aG1cbiAgICAgICAgLy8gICAgICAgYW5kIHByZWZlciB0byBvcmRlciByZW1vdmFscyBiZWZvcmUgaW5zZXJ0aW9ucy5cbiAgICAgICAgaWYgKCFjYW5SZW1vdmUgfHwgKGNhbkFkZCAmJiByZW1vdmVQYXRoLm9sZFBvcyArIDEgPCBhZGRQYXRoLm9sZFBvcykpIHtcbiAgICAgICAgICBiYXNlUGF0aCA9IHNlbGYuYWRkVG9QYXRoKGFkZFBhdGgsIHRydWUsIHVuZGVmaW5lZCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYmFzZVBhdGggPSBzZWxmLmFkZFRvUGF0aChyZW1vdmVQYXRoLCB1bmRlZmluZWQsIHRydWUsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgbmV3UG9zID0gc2VsZi5leHRyYWN0Q29tbW9uKGJhc2VQYXRoLCBuZXdTdHJpbmcsIG9sZFN0cmluZywgZGlhZ29uYWxQYXRoKTtcblxuICAgICAgICBpZiAoYmFzZVBhdGgub2xkUG9zICsgMSA+PSBvbGRMZW4gJiYgbmV3UG9zICsgMSA+PSBuZXdMZW4pIHtcbiAgICAgICAgICAvLyBJZiB3ZSBoYXZlIGhpdCB0aGUgZW5kIG9mIGJvdGggc3RyaW5ncywgdGhlbiB3ZSBhcmUgZG9uZVxuICAgICAgICAgIHJldHVybiBkb25lKGJ1aWxkVmFsdWVzKHNlbGYsIGJhc2VQYXRoLmxhc3RDb21wb25lbnQsIG5ld1N0cmluZywgb2xkU3RyaW5nLCBzZWxmLnVzZUxvbmdlc3RUb2tlbikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJlc3RQYXRoW2RpYWdvbmFsUGF0aF0gPSBiYXNlUGF0aDtcbiAgICAgICAgICBpZiAoYmFzZVBhdGgub2xkUG9zICsgMSA+PSBvbGRMZW4pIHtcbiAgICAgICAgICAgIG1heERpYWdvbmFsVG9Db25zaWRlciA9IE1hdGgubWluKG1heERpYWdvbmFsVG9Db25zaWRlciwgZGlhZ29uYWxQYXRoIC0gMSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChuZXdQb3MgKyAxID49IG5ld0xlbikge1xuICAgICAgICAgICAgbWluRGlhZ29uYWxUb0NvbnNpZGVyID0gTWF0aC5tYXgobWluRGlhZ29uYWxUb0NvbnNpZGVyLCBkaWFnb25hbFBhdGggKyAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWRpdExlbmd0aCsrO1xuICAgIH1cblxuICAgIC8vIFBlcmZvcm1zIHRoZSBsZW5ndGggb2YgZWRpdCBpdGVyYXRpb24uIElzIGEgYml0IGZ1Z2x5IGFzIHRoaXMgaGFzIHRvIHN1cHBvcnQgdGhlXG4gICAgLy8gc3luYyBhbmQgYXN5bmMgbW9kZSB3aGljaCBpcyBuZXZlciBmdW4uIExvb3BzIG92ZXIgZXhlY0VkaXRMZW5ndGggdW50aWwgYSB2YWx1ZVxuICAgIC8vIGlzIHByb2R1Y2VkLCBvciB1bnRpbCB0aGUgZWRpdCBsZW5ndGggZXhjZWVkcyBvcHRpb25zLm1heEVkaXRMZW5ndGggKGlmIGdpdmVuKSxcbiAgICAvLyBpbiB3aGljaCBjYXNlIGl0IHdpbGwgcmV0dXJuIHVuZGVmaW5lZC5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIChmdW5jdGlvbiBleGVjKCkge1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmIChlZGl0TGVuZ3RoID4gbWF4RWRpdExlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFleGVjRWRpdExlbmd0aCgpKSB7XG4gICAgICAgICAgICBleGVjKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAwKTtcbiAgICAgIH0oKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdoaWxlIChlZGl0TGVuZ3RoIDw9IG1heEVkaXRMZW5ndGgpIHtcbiAgICAgICAgbGV0IHJldCA9IGV4ZWNFZGl0TGVuZ3RoKCk7XG4gICAgICAgIGlmIChyZXQpIHtcbiAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGFkZFRvUGF0aChwYXRoLCBhZGRlZCwgcmVtb3ZlZCwgb2xkUG9zSW5jKSB7XG4gICAgbGV0IGxhc3QgPSBwYXRoLmxhc3RDb21wb25lbnQ7XG4gICAgaWYgKGxhc3QgJiYgbGFzdC5hZGRlZCA9PT0gYWRkZWQgJiYgbGFzdC5yZW1vdmVkID09PSByZW1vdmVkKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvbGRQb3M6IHBhdGgub2xkUG9zICsgb2xkUG9zSW5jLFxuICAgICAgICBsYXN0Q29tcG9uZW50OiB7Y291bnQ6IGxhc3QuY291bnQgKyAxLCBhZGRlZDogYWRkZWQsIHJlbW92ZWQ6IHJlbW92ZWQsIHByZXZpb3VzQ29tcG9uZW50OiBsYXN0LnByZXZpb3VzQ29tcG9uZW50IH1cbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9sZFBvczogcGF0aC5vbGRQb3MgKyBvbGRQb3NJbmMsXG4gICAgICAgIGxhc3RDb21wb25lbnQ6IHtjb3VudDogMSwgYWRkZWQ6IGFkZGVkLCByZW1vdmVkOiByZW1vdmVkLCBwcmV2aW91c0NvbXBvbmVudDogbGFzdCB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcbiAgZXh0cmFjdENvbW1vbihiYXNlUGF0aCwgbmV3U3RyaW5nLCBvbGRTdHJpbmcsIGRpYWdvbmFsUGF0aCkge1xuICAgIGxldCBuZXdMZW4gPSBuZXdTdHJpbmcubGVuZ3RoLFxuICAgICAgICBvbGRMZW4gPSBvbGRTdHJpbmcubGVuZ3RoLFxuICAgICAgICBvbGRQb3MgPSBiYXNlUGF0aC5vbGRQb3MsXG4gICAgICAgIG5ld1BvcyA9IG9sZFBvcyAtIGRpYWdvbmFsUGF0aCxcblxuICAgICAgICBjb21tb25Db3VudCA9IDA7XG4gICAgd2hpbGUgKG5ld1BvcyArIDEgPCBuZXdMZW4gJiYgb2xkUG9zICsgMSA8IG9sZExlbiAmJiB0aGlzLmVxdWFscyhuZXdTdHJpbmdbbmV3UG9zICsgMV0sIG9sZFN0cmluZ1tvbGRQb3MgKyAxXSkpIHtcbiAgICAgIG5ld1BvcysrO1xuICAgICAgb2xkUG9zKys7XG4gICAgICBjb21tb25Db3VudCsrO1xuICAgIH1cblxuICAgIGlmIChjb21tb25Db3VudCkge1xuICAgICAgYmFzZVBhdGgubGFzdENvbXBvbmVudCA9IHtjb3VudDogY29tbW9uQ291bnQsIHByZXZpb3VzQ29tcG9uZW50OiBiYXNlUGF0aC5sYXN0Q29tcG9uZW50fTtcbiAgICB9XG5cbiAgICBiYXNlUGF0aC5vbGRQb3MgPSBvbGRQb3M7XG4gICAgcmV0dXJuIG5ld1BvcztcbiAgfSxcblxuICBlcXVhbHMobGVmdCwgcmlnaHQpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbXBhcmF0b3IpIHtcbiAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuY29tcGFyYXRvcihsZWZ0LCByaWdodCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBsZWZ0ID09PSByaWdodFxuICAgICAgICB8fCAodGhpcy5vcHRpb25zLmlnbm9yZUNhc2UgJiYgbGVmdC50b0xvd2VyQ2FzZSgpID09PSByaWdodC50b0xvd2VyQ2FzZSgpKTtcbiAgICB9XG4gIH0sXG4gIHJlbW92ZUVtcHR5KGFycmF5KSB7XG4gICAgbGV0IHJldCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJheVtpXSkge1xuICAgICAgICByZXQucHVzaChhcnJheVtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sXG4gIGNhc3RJbnB1dCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfSxcbiAgdG9rZW5pemUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUuc3BsaXQoJycpO1xuICB9LFxuICBqb2luKGNoYXJzKSB7XG4gICAgcmV0dXJuIGNoYXJzLmpvaW4oJycpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBidWlsZFZhbHVlcyhkaWZmLCBsYXN0Q29tcG9uZW50LCBuZXdTdHJpbmcsIG9sZFN0cmluZywgdXNlTG9uZ2VzdFRva2VuKSB7XG4gIC8vIEZpcnN0IHdlIGNvbnZlcnQgb3VyIGxpbmtlZCBsaXN0IG9mIGNvbXBvbmVudHMgaW4gcmV2ZXJzZSBvcmRlciB0byBhblxuICAvLyBhcnJheSBpbiB0aGUgcmlnaHQgb3JkZXI6XG4gIGNvbnN0IGNvbXBvbmVudHMgPSBbXTtcbiAgbGV0IG5leHRDb21wb25lbnQ7XG4gIHdoaWxlIChsYXN0Q29tcG9uZW50KSB7XG4gICAgY29tcG9uZW50cy5wdXNoKGxhc3RDb21wb25lbnQpO1xuICAgIG5leHRDb21wb25lbnQgPSBsYXN0Q29tcG9uZW50LnByZXZpb3VzQ29tcG9uZW50O1xuICAgIGRlbGV0ZSBsYXN0Q29tcG9uZW50LnByZXZpb3VzQ29tcG9uZW50O1xuICAgIGxhc3RDb21wb25lbnQgPSBuZXh0Q29tcG9uZW50O1xuICB9XG4gIGNvbXBvbmVudHMucmV2ZXJzZSgpO1xuXG4gIGxldCBjb21wb25lbnRQb3MgPSAwLFxuICAgICAgY29tcG9uZW50TGVuID0gY29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBuZXdQb3MgPSAwLFxuICAgICAgb2xkUG9zID0gMDtcblxuICBmb3IgKDsgY29tcG9uZW50UG9zIDwgY29tcG9uZW50TGVuOyBjb21wb25lbnRQb3MrKykge1xuICAgIGxldCBjb21wb25lbnQgPSBjb21wb25lbnRzW2NvbXBvbmVudFBvc107XG4gICAgaWYgKCFjb21wb25lbnQucmVtb3ZlZCkge1xuICAgICAgaWYgKCFjb21wb25lbnQuYWRkZWQgJiYgdXNlTG9uZ2VzdFRva2VuKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IG5ld1N0cmluZy5zbGljZShuZXdQb3MsIG5ld1BvcyArIGNvbXBvbmVudC5jb3VudCk7XG4gICAgICAgIHZhbHVlID0gdmFsdWUubWFwKGZ1bmN0aW9uKHZhbHVlLCBpKSB7XG4gICAgICAgICAgbGV0IG9sZFZhbHVlID0gb2xkU3RyaW5nW29sZFBvcyArIGldO1xuICAgICAgICAgIHJldHVybiBvbGRWYWx1ZS5sZW5ndGggPiB2YWx1ZS5sZW5ndGggPyBvbGRWYWx1ZSA6IHZhbHVlO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb21wb25lbnQudmFsdWUgPSBkaWZmLmpvaW4odmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50LnZhbHVlID0gZGlmZi5qb2luKG5ld1N0cmluZy5zbGljZShuZXdQb3MsIG5ld1BvcyArIGNvbXBvbmVudC5jb3VudCkpO1xuICAgICAgfVxuICAgICAgbmV3UG9zICs9IGNvbXBvbmVudC5jb3VudDtcblxuICAgICAgLy8gQ29tbW9uIGNhc2VcbiAgICAgIGlmICghY29tcG9uZW50LmFkZGVkKSB7XG4gICAgICAgIG9sZFBvcyArPSBjb21wb25lbnQuY291bnQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbXBvbmVudC52YWx1ZSA9IGRpZmYuam9pbihvbGRTdHJpbmcuc2xpY2Uob2xkUG9zLCBvbGRQb3MgKyBjb21wb25lbnQuY291bnQpKTtcbiAgICAgIG9sZFBvcyArPSBjb21wb25lbnQuY291bnQ7XG5cbiAgICAgIC8vIFJldmVyc2UgYWRkIGFuZCByZW1vdmUgc28gcmVtb3ZlcyBhcmUgb3V0cHV0IGZpcnN0IHRvIG1hdGNoIGNvbW1vbiBjb252ZW50aW9uXG4gICAgICAvLyBUaGUgZGlmZmluZyBhbGdvcml0aG0gaXMgdGllZCB0byBhZGQgdGhlbiByZW1vdmUgb3V0cHV0IGFuZCB0aGlzIGlzIHRoZSBzaW1wbGVzdFxuICAgICAgLy8gcm91dGUgdG8gZ2V0IHRoZSBkZXNpcmVkIG91dHB1dCB3aXRoIG1pbmltYWwgb3ZlcmhlYWQuXG4gICAgICBpZiAoY29tcG9uZW50UG9zICYmIGNvbXBvbmVudHNbY29tcG9uZW50UG9zIC0gMV0uYWRkZWQpIHtcbiAgICAgICAgbGV0IHRtcCA9IGNvbXBvbmVudHNbY29tcG9uZW50UG9zIC0gMV07XG4gICAgICAgIGNvbXBvbmVudHNbY29tcG9uZW50UG9zIC0gMV0gPSBjb21wb25lbnRzW2NvbXBvbmVudFBvc107XG4gICAgICAgIGNvbXBvbmVudHNbY29tcG9uZW50UG9zXSA9IHRtcDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTcGVjaWFsIGNhc2UgaGFuZGxlIGZvciB3aGVuIG9uZSB0ZXJtaW5hbCBpcyBpZ25vcmVkIChpLmUuIHdoaXRlc3BhY2UpLlxuICAvLyBGb3IgdGhpcyBjYXNlIHdlIG1lcmdlIHRoZSB0ZXJtaW5hbCBpbnRvIHRoZSBwcmlvciBzdHJpbmcgYW5kIGRyb3AgdGhlIGNoYW5nZS5cbiAgLy8gVGhpcyBpcyBvbmx5IGF2YWlsYWJsZSBmb3Igc3RyaW5nIG1vZGUuXG4gIGxldCBmaW5hbENvbXBvbmVudCA9IGNvbXBvbmVudHNbY29tcG9uZW50TGVuIC0gMV07XG4gIGlmIChjb21wb25lbnRMZW4gPiAxXG4gICAgICAmJiB0eXBlb2YgZmluYWxDb21wb25lbnQudmFsdWUgPT09ICdzdHJpbmcnXG4gICAgICAmJiAoZmluYWxDb21wb25lbnQuYWRkZWQgfHwgZmluYWxDb21wb25lbnQucmVtb3ZlZClcbiAgICAgICYmIGRpZmYuZXF1YWxzKCcnLCBmaW5hbENvbXBvbmVudC52YWx1ZSkpIHtcbiAgICBjb21wb25lbnRzW2NvbXBvbmVudExlbiAtIDJdLnZhbHVlICs9IGZpbmFsQ29tcG9uZW50LnZhbHVlO1xuICAgIGNvbXBvbmVudHMucG9wKCk7XG4gIH1cblxuICByZXR1cm4gY29tcG9uZW50cztcbn1cbiJdfQ==