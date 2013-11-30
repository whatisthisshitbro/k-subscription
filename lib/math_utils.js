
Math.createLinearFunction = function(m, b) {
  /* f(x) = mx + b */
  return function(x) {
    return m * x + b;
  };
};

Math.linearLeastSquares = function(points, xOffset) {
  /* Using linear least squares method to create an equation in the form f(x) = mx + b */

  var n = points.length;
  if(n === 0) {
    return null;
  }
  if(!xOffset) {
    xOffset = 0;
  }

  /* Calculate sums that'll be needed latter */
  var sum_x = 0, sum_y = 0, sum_xy = 0, sum_x_squared = 0;
  for(var i = 0; i < n; ++i) {
    var point = points[i];
    var x = point[0] - xOffset, y = point[1];
    sum_x += x;
    sum_y += y;
    sum_xy += x * y;
    sum_x_squared += x * x;
  }

  /* Calculating deviation, matrix determinant of
     | sum_x_squared  sum_x |
     | sum_x          n     |
  */
  var d = (n * sum_x_squared) - (sum_x * sum_x);

  /* Calculating m component
     | sum_xy  sum_x |
     | sum_y   n     | / deviation
  */
  var m = ((n * sum_xy) - (sum_x * sum_y)) / d;

  /* Calculating b component
     | sum_x_squared  sum_xy |
     | sum_x          sum_y  | / deviation
  */
  var b = ((sum_x_squared * sum_y) - (sum_xy * sum_x)) / d;

  return Math.createLinearFunction(m, b);
};